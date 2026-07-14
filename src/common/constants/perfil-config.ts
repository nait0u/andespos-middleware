/**
 * Mapeo autoritativo de perfiles → payload SDTIniSessionTest que GeneXus espera
 * en InicializarContexto. Los valores son fijos por perfil para garantizar que el
 * monolito reciba exactamente la estructura validada en certificación.
 *
 * Si un perfil no está aquí, el middleware debe fallar antes de tocar GeneXus —
 * adivinar valores corrompe la sesión y el Hash del token B2B.
 */
export interface PerfilConfig {
  RutUsuario: string;
  RutUsuarioDV: string;
  Nombre: string;
  Perfil: string;
  PerfilDesc: string;
  Mandante: string;
  RutEmpresa: string;
  Sucursal: string;
  EmpKey: number;
  PuntoAccesoKey: number;
  EstacionIdl: string;
  ModoConexion: string;
  ModuloAplicacionIdl: string;
}

export const PERFIL_CONFIG: Record<string, PerfilConfig> = {
  posadmcert: {
    RutUsuario: '18373061',
    RutUsuarioDV: '183730614',
    Nombre: 'CONSTANZA PALOMO MIRANDA',
    Perfil: 'posadmcert',
    PerfilDesc: 'POS Administrador Certificador',
    Mandante: '76407930',
    RutEmpresa: '500000023',
    Sucursal: '',
    EmpKey: 1008,
    PuntoAccesoKey: 0,
    EstacionIdl: '',
    ModoConexion: 'Remoto',
    ModuloAplicacionIdl: 'XXXXXX',
  },
  CAJERAADMINISTRATIVA: {
    RutUsuario: '20613830',
    RutUsuarioDV: '206138300',
    Nombre: 'Jaime Medalla Astete',
    Perfil: 'CAJERAADMINISTRATIVA',
    PerfilDesc: 'CAJERA ADMINISTRATIVA',
    Mandante: '76407930',
    RutEmpresa: '500000023',
    Sucursal: 'Local1',
    EmpKey: 1008,
    PuntoAccesoKey: 2,
    EstacionIdl: 'CAJA1',
    ModoConexion: 'Local',
    ModuloAplicacionIdl: 'CAJA',
  },
};
