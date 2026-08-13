import { AlcanceResolverService } from './alcance-resolver.service.js';

const alc = (AlcancePath: string, AlcanceTemplatePath: string) => ({ AlcancePath, AlcanceTemplatePath });

const TEMPLATE_EMPRESA = '.Empresa.EmpresaKey.EmpresaRut.EmpresaNombre.';
const TEMPLATE_EMPRESA_SUC = '.Empresa.EmpresaKey.EmpresaRut.EmpresaNombre.SucursalIdL.SucursalNombre.';
const TEMPLATE_AMBIENTE = '.Ambiente.TipoAmbiente.';

describe('AlcanceResolverService', () => {
  const service = new AlcanceResolverService();

  it('resuelve un alcance bien formado bajo la clave de su raíz', () => {
    const r = service.resolver([alc('.Empresa.1234.76543210-9.ACME EJEMPLO.', TEMPLATE_EMPRESA)]);
    expect(r.alcances['Empresa']).toEqual({
      EmpresaKey: '1234',
      EmpresaRut: '76543210-9',
      EmpresaNombre: 'ACME EJEMPLO',
    });
    expect(r.problemas).toEqual([]);
  });

  it('resuelve más de un alcance en la misma llamada (Empresa + Ambiente, doc §3.4)', () => {
    const r = service.resolver([
      alc('.Empresa.1234.76543210-9.ACME EJEMPLO.', TEMPLATE_EMPRESA),
      alc('.Ambiente.Produccion.', TEMPLATE_AMBIENTE),
    ]);
    expect(r.alcances['Empresa']!['EmpresaKey']).toBe('1234');
    expect(r.alcances['Ambiente']).toEqual({ TipoAmbiente: 'Produccion' });
  });

  it('tolera la raíz real observada en producción con asterisco ("*Empresa")', () => {
    const r = service.resolver([
      alc('.*Empresa.977.921760000.ACEROS AZA S.A..', '.*Empresa.EmpresaKey.EmpresaRut.EmpresaNombre.'),
    ]);
    expect(Object.keys(r.alcances)).toEqual(['Empresa']);
  });

  it('nombre con puntos: tail-greedy recupera el valor completo y degrada con desborde_puntos', () => {
    const r = service.resolver([alc('.Empresa.6789.76123456.ACEROS AZA S.A..', TEMPLATE_EMPRESA)]);
    expect(r.alcances['Empresa']).toEqual({
      EmpresaKey: '6789',
      EmpresaRut: '76123456',
      EmpresaNombre: 'ACEROS AZA S.A.',
    });
    expect(r.problemas).toHaveLength(1);
    expect(r.problemas[0]!.tipo).toBe('desborde_puntos');
  });

  it('sucursal fantasma (segmentos en blanco) degrada con sucursal_fantasma', () => {
    const r = service.resolver([alc('.Empresa.2222.96789010.EMPRESA SUR. . .', TEMPLATE_EMPRESA_SUC)]);
    expect(r.alcances['Empresa']!['EmpresaKey']).toBe('2222');
    expect(r.problemas.map((p) => p.tipo)).toContain('sucursal_fantasma');
  });

  it('sucursal real no genera problemas', () => {
    const r = service.resolver([alc('.Empresa.2222.96789010.EMPRESA SUR.5.CASA MATRIZ.', TEMPLATE_EMPRESA_SUC)]);
    expect(r.problemas).toEqual([]);
    expect(r.alcances['Empresa']!['SucursalIdL']).toBe('5');
  });

  it('alcance corto con etiqueta repetida', () => {
    const r = service.resolver([
      alc('.Ambiente.AmbientesEnternet.certificacionypruebas.', '.Ambiente.TipoAmbiente.TipoAmbiente.AmbienteNombre.'),
    ]);
    const tipos = r.problemas.map((p) => p.tipo);
    expect(tipos).toContain('alcance_corto');
    expect(tipos).toContain('etiqueta_repetida');
  });

  it('conjunto vacío no produce alcances ni problemas', () => {
    const r = service.resolver([]);
    expect(r.alcances).toEqual({});
    expect(r.problemas).toEqual([]);
  });
});
