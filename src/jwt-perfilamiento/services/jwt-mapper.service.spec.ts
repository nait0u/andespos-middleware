import type { JWTPayload } from 'jose';
import { JwtMapperService } from './jwt-mapper.service.js';

const service = new JwtMapperService();

function rolBase() {
  return {
    RolName: 'AdminGuias',
    RolKey: 93,
    PerfilIdL: 'AdminCobru',
    PerfilName: 'Administrador',
    PerfilDescripcion: 'Administrador de Cobranza',
    Alcance: [{ AlcancePath: '.Empresa.1234.', AlcanceTemplatePath: '.Empresa.EmpresaKey.' }],
    Atribucion: [{ AtribucionPath: '.Menu.Ver', Propiedad: 'RWXD' }],
  };
}

function payloadBase(overrides: Partial<JWTPayload> = {}): JWTPayload {
  return {
    iss: { Nombre: 'LanzaderaPerfilamientoEnternet' },
    aud: { AgenteKey: 987, AgenteName: 'Juan', AgenteLastName: 'Pérez', PI: [{ PI_Tipo: 'RUT', PI_Valor: '12345678-5' }] },
    Rol: rolBase(),
    jti: 'uuid-1234',
    iat: 1710000000,
    nbf: 1710000000,
    exp: 1710086400,
    ...overrides,
  } as unknown as JWTPayload;
}

describe('JwtMapperService', () => {
  it('mapea un payload con aud/Rol como objeto anidado', () => {
    const r = service.mapear(payloadBase(), 'jwt-crudo');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.authzJwt.aud.AgenteKey).toBe(987);
      expect(r.authzJwt.rol.PerfilIdL).toBe('AdminCobru');
      expect(r.authzJwt.jwt).toBe('jwt-crudo');
    }
  });

  it('mapea un payload con aud/Rol serializados como string JSON', () => {
    const r = service.mapear(
      payloadBase({
        iss: JSON.stringify({ Nombre: 'LanzaderaPerfilamientoEnternet' }),
        aud: JSON.stringify({ AgenteKey: 5, AgenteName: 'Ana', AgenteLastName: 'Soto', PI: [] }),
        Rol: JSON.stringify(rolBase()),
      }),
      'jwt-crudo',
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.authzJwt.aud.AgenteKey).toBe(5);
  });

  it('issuer distinto al pineado → iss_invalido', () => {
    const r = service.mapear(payloadBase({ iss: { Nombre: 'OtroEmisor' } }), 'jwt-crudo');
    expect(r).toEqual({ ok: false, tipo: 'iss_invalido' });
  });

  it('extrae Asignacion desde el sufijo ":<n>" del jti cuando no viene como claim propio', () => {
    const r = service.mapear(payloadBase({ jti: 'uuid-abc:1234' }), 'jwt-crudo');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.authzJwt.jti).toBe('uuid-abc:1234');
      expect(r.authzJwt.asignacion).toBe(1234);
    }
  });

  it('el claim Asignacion explícito tiene prioridad sobre el sufijo del jti', () => {
    const r = service.mapear(payloadBase({ jti: 'uuid-abc:1234', Asignacion: 999 } as Partial<JWTPayload>), 'jwt-crudo');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.authzJwt.asignacion).toBe(999);
  });

  it('sin Rol ni sufijo de asignación → asignacion queda null', () => {
    const r = service.mapear(payloadBase({ jti: 'uuid-sin-sufijo' }), 'jwt-crudo');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.authzJwt.asignacion).toBeNull();
  });

  it('iat se conserva como ISO pero no se usa en ninguna decisión del mapeo', () => {
    const r = service.mapear(payloadBase({ iat: 1600000000 }), 'jwt-crudo');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.authzJwt.iatISO).toBe(new Date(1600000000 * 1000).toISOString());
  });

  it('estructura inválida (falta jti) → estructura_invalida', () => {
    const payload = payloadBase();
    delete (payload as Record<string, unknown>)['jti'];
    const r = service.mapear(payload, 'jwt-crudo');
    expect(r).toEqual({ ok: false, tipo: 'estructura_invalida' });
  });

  it('Rol ilegible (string no-JSON) → estructura_invalida', () => {
    const r = service.mapear(payloadBase({ Rol: 'esto-no-es-json' } as Partial<JWTPayload>), 'jwt-crudo');
    expect(r).toEqual({ ok: false, tipo: 'estructura_invalida' });
  });
});
