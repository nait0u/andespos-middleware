import { generateKeyPair, SignJWT } from 'jose';
import { JwtVerificationService } from './jwt-verification.service.js';
import { ClavePublicaInvalidaError } from './public-key-loader.service.js';

const AHORA = new Date('2026-08-01T12:00:00Z');
const epoch = (d: Date) => Math.floor(d.getTime() / 1000);
const min = 60;

function basePayload(): Record<string, unknown> {
  return {
    iss: JSON.stringify({ Nombre: 'LanzaderaPerfilamientoEnternet' }),
    aud: JSON.stringify({ AgenteKey: 1, AgenteName: 'Juan', AgenteLastName: 'Pérez', PI: [] }),
    jti: 'uuid-1234',
    Rol: JSON.stringify({ Alcance: [], Atribucion: [] }),
  };
}

interface OpcionesFirma {
  alg?: 'RS256' | 'HS256';
  nbfOffsetSeg?: number;
  expOffsetSeg?: number;
}

async function firmar(payload: Record<string, unknown>, key: unknown, opts: OpcionesFirma = {}): Promise<string> {
  const nbf = epoch(AHORA) + (opts.nbfOffsetSeg ?? -min);
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: opts.alg ?? 'RS256' })
    .setNotBefore(nbf)
    .setExpirationTime(opts.expOffsetSeg !== undefined ? epoch(AHORA) + opts.expOffsetSeg : nbf + 24 * 3600)
    .setIssuedAt(epoch(AHORA) - min);
  if (opts.alg === 'HS256') {
    return jwt.sign(new TextEncoder().encode('secreto-de-test-hs256'.repeat(2)));
  }
  return jwt.sign(key as Parameters<typeof jwt.sign>[0]);
}

function fakeConfigService(grace?: number) {
  return { get: () => grace } as unknown as import('@nestjs/config').ConfigService;
}

function fakePublicKeyLoader(key: CryptoKey | (() => Promise<CryptoKey>)) {
  return {
    getPublicKey: async () => (typeof key === 'function' ? key() : key),
  } as unknown as import('./public-key-loader.service.js').PublicKeyLoaderService;
}

describe('JwtVerificationService', () => {
  let publica: CryptoKey;
  let privada: CryptoKey;
  let privadaOtra: CryptoKey;

  beforeAll(async () => {
    const par = await generateKeyPair('RS256');
    publica = par.publicKey;
    privada = par.privateKey;
    privadaOtra = (await generateKeyPair('RS256')).privateKey;
  });

  it('token válido → verificación OK', async () => {
    const service = new JwtVerificationService(fakePublicKeyLoader(publica), fakeConfigService());
    const jwt = await firmar(basePayload(), privada);
    const r = await service.verificar(jwt, { ahora: AHORA });
    expect(r.ok).toBe(true);
  });

  it('ataque de confusión de algoritmo (HS256 firmado con la clave pública como secreto) → alg_invalido', async () => {
    const service = new JwtVerificationService(fakePublicKeyLoader(publica), fakeConfigService());
    const jwt = await firmar(basePayload(), null, { alg: 'HS256' });
    const r = await service.verificar(jwt, { ahora: AHORA });
    expect(r).toEqual({ ok: false, tipo: 'alg_invalido' });
  });

  it('firma con otra clave → firma_invalida', async () => {
    const service = new JwtVerificationService(fakePublicKeyLoader(publica), fakeConfigService());
    const jwt = await firmar(basePayload(), privadaOtra);
    const r = await service.verificar(jwt, { ahora: AHORA });
    expect(r).toEqual({ ok: false, tipo: 'firma_invalida' });
  });

  it('token basura → token_malformado', async () => {
    const service = new JwtVerificationService(fakePublicKeyLoader(publica), fakeConfigService());
    const r = await service.verificar('no-es-un-jwt');
    expect(r).toEqual({ ok: false, tipo: 'token_malformado' });
  });

  it('nbf en el futuro fuera de tolerancia → periodo_invalido con reentryUrl', async () => {
    const service = new JwtVerificationService(fakePublicKeyLoader(publica), fakeConfigService(60));
    const payload = { ...basePayload(), ReentryURL: 'https://lanzadera.example/reentry' };
    const jwt = await firmar(payload, privada, { nbfOffsetSeg: 6 * min });
    const r = await service.verificar(jwt, { ahora: AHORA });
    expect(r).toEqual({ ok: false, tipo: 'periodo_invalido', reentryUrl: 'https://lanzadera.example/reentry' });
  });

  it('tolerancia configurable: con 60s, nbf a 4 min en el futuro ya expira', async () => {
    const service = new JwtVerificationService(fakePublicKeyLoader(publica), fakeConfigService(60));
    const jwt = await firmar(basePayload(), privada, { nbfOffsetSeg: 4 * min });
    const r = await service.verificar(jwt, { ahora: AHORA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.tipo).toBe('periodo_invalido');
  });

  it('clave pública no importable → clave_publica_invalida', async () => {
    const loaderRoto = {
      getPublicKey: async () => {
        throw new ClavePublicaInvalidaError('PEM corrupto');
      },
    } as unknown as import('./public-key-loader.service.js').PublicKeyLoaderService;
    const service = new JwtVerificationService(loaderRoto, fakeConfigService());
    const jwt = await firmar(basePayload(), privada);
    const r = await service.verificar(jwt, { ahora: AHORA });
    expect(r).toEqual({ ok: false, tipo: 'clave_publica_invalida' });
  });
});
