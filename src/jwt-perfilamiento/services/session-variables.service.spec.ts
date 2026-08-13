import { generateKeyPair, SignJWT } from 'jose';
import { JwtVerificationService } from './jwt-verification.service.js';
import { JwtMapperService } from './jwt-mapper.service.js';
import { AlcanceResolverService } from './alcance-resolver.service.js';
import { SessionVariablesService } from './session-variables.service.js';
import type { PublicKeyLoaderService } from './public-key-loader.service.js';

const AHORA = new Date('2026-08-01T12:00:00Z');
const epoch = (d: Date) => Math.floor(d.getTime() / 1000);
const min = 60;

function fakeConfigService() {
  return { get: () => undefined } as unknown as import('@nestjs/config').ConfigService;
}

function fakePublicKeyLoader(key: CryptoKey) {
  return { getPublicKey: async () => key } as unknown as PublicKeyLoaderService;
}

describe('SessionVariablesService (integración)', () => {
  let service: SessionVariablesService;
  let privada: CryptoKey;

  beforeAll(async () => {
    const par = await generateKeyPair('RS256');
    privada = par.privateKey;

    const verification = new JwtVerificationService(fakePublicKeyLoader(par.publicKey), fakeConfigService());
    const mapper = new JwtMapperService();
    const alcanceResolver = new AlcanceResolverService();
    service = new SessionVariablesService(verification, mapper, alcanceResolver);
  });

  async function firmarTokenCompleto(): Promise<string> {
    const payload = {
      iss: JSON.stringify({ Nombre: 'LanzaderaPerfilamientoEnternet' }),
      aud: JSON.stringify({
        AgenteKey: 987,
        AgenteName: 'Juan',
        AgenteLastName: 'Pérez',
        PI: [
          { PI_Tipo: 'RUT', PI_Valor: '12.345.678-5' },
          { PI_Tipo: 'CORREO', PI_Valor: 'juan@correo.cl' },
        ],
      }),
      Rol: JSON.stringify({
        RolName: 'Administrador',
        RolKey: 42,
        PerfilIdL: 'AdminCobru',
        PerfilName: 'Administrador de Cobranza',
        PerfilDescripcion: 'Administra la cobranza de la empresa',
        Alcance: [
          {
            AlcancePath: '.Empresa.1234.76543210-9.ACME EJEMPLO.',
            AlcanceTemplatePath: '.Empresa.EmpresaKey.EmpresaRut.EmpresaNombre.',
          },
          { AlcancePath: '.Ambiente.Produccion.', AlcanceTemplatePath: '.Ambiente.TipoAmbiente.' },
        ],
        Atribucion: [{ AtribucionPath: '.Menu.Deudores.Ver', Propiedad: 'RWXD' }],
      }),
      jti: 'uuid-1234:1234',
      ReentryURL: 'https://lanzadera.example/reentry',
    };

    const nbf = epoch(AHORA) - min;
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256' })
      .setNotBefore(nbf)
      .setExpirationTime(nbf + 24 * 3600)
      .setIssuedAt(nbf)
      .sign(privada);
  }

  it('produce el diccionario completo de variables de sesión (§5.1-§5.3)', async () => {
    const jwt = await firmarTokenCompleto();
    const r = await service.validar(jwt, 'OnBoarding', { ahora: AHORA });

    expect(r.validatedOK).toBe(true);
    expect(r.periodOK).toBe(true);
    if (!r.validatedOK || !r.periodOK) return;

    // Identidad del holder — lo que la implementación de referencia no cubría.
    expect(r.sessionVariables._RUTUSU).toBe('123456785');
    expect(r.sessionVariables.RUTNODV).toBe('12345678');
    expect(r.sessionVariables._NOMUSU).toBe('Juan Pérez');
    expect(r.sessionVariables._CORREO).toBe('juan@correo.cl');

    // Perfil.
    expect(r.sessionVariables._NOTPERFIL).toBe('AdminCobru');
    expect(r.sessionVariables._NOTPERFILDES).toBe('Administra la cobranza de la empresa');

    // Alcances resueltos genéricamente, incluyendo uno que no es Empresa.
    expect(r.sessionVariables.EmpresaKey).toBe('1234');
    expect(r.sessionVariables.empkey).toBe('1234');
    expect(r.sessionVariables.EmpresaRut).toBe('76543210-9');
    expect(r.sessionVariables.EmpresaNombre).toBe('ACME EJEMPLO');
    expect(r.sessionVariables.alcances['Ambiente']).toEqual({ TipoAmbiente: 'Produccion' });

    // Metadatos.
    expect(r.sessionVariables._NODORAIZ).toBe('OnBoarding');
    expect(r.sessionVariables.CHGROLURI).toBe('https://lanzadera.example/reentry');
    expect(r.problemas).toEqual([]);

    // Getters (§5.4) sobre el AuthzJWT devuelto.
    expect(r.authzJwt.asignacion).toBe(1234);
  });

  it('token expirado devuelve periodOK=false con reentryUrl para redirect', async () => {
    const payload = {
      iss: JSON.stringify({ Nombre: 'LanzaderaPerfilamientoEnternet' }),
      aud: JSON.stringify({ AgenteKey: 1, AgenteName: 'A', AgenteLastName: 'B', PI: [] }),
      Rol: JSON.stringify({ Alcance: [], Atribucion: [] }),
      jti: 'uuid-x',
      ReentryURL: 'https://lanzadera.example/reentry',
    };
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256' })
      .setNotBefore(epoch(AHORA) - 20 * min)
      .setExpirationTime(epoch(AHORA) - 10 * min)
      .setIssuedAt(epoch(AHORA) - 20 * min)
      .sign(privada);

    const r = await service.validar(jwt, undefined, { ahora: AHORA });
    expect(r).toEqual({ validatedOK: true, periodOK: false, reentryUrl: 'https://lanzadera.example/reentry' });
  });
});
