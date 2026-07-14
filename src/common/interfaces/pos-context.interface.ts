/** Contexto POS consolidado inyectado por PosContextGuard en cada request */
export interface IPosContext {
  /** Clave de empresa (header x-pos-emp-key / POS_DEV_EMP_KEY) */
  EmpKey: number;
  /** Clave del punto de acceso (header x-pos-punto-acceso-key / POS_DEV_PUNTO_ACCESO_KEY) */
  PuntoAccesoKey: number;
  /** Descripción del punto de acceso (header x-pos-punto-acceso-desc / POS_DEV_PUNTO_ACCESO_DESC) */
  PuntoAccesoDescripcion: string;
  /** Identificador de la estación dentro del turno (header x-pos-estacion-turno-idl / POS_DEV_ESTACION_TURNO_IDL) */
  EstacionTurnoIdl: string;
  /** Identificador físico del dispositivo (DispositivoId del token validado) */
  EstacionIdl: string;
  /** AmbienteId del dispositivo (producción, capacitación, etc.) */
  Ambiente: string;
  /** DispositivoId del token validado */
  DispositivoId: string;
  /** Modo operativo del terminal (header x-pos-modo). Por defecto: 'NotaVenta' */
  Modo: string;
  /** Clave del vendedor/operador activo (header x-pos-vendedor-key). Default: 0 */
  VendedorKey: number;
  /** Clave del turno de caja activo (header x-pos-turno-caja-key / POS_DEV_TURNO_CAJA_KEY) */
  TurnoCajaKey: number;
  /** Indica si la estación es una caja registradora (header x-pos-estacion-es-caja). Default: false */
  EstacionTurnoEsCaja: boolean;
  /** Token de autenticación raw (M2406 si viene del guard M2406, vacío en path x-pos-user) */
  token: string;

  // ── Identidad del usuario ─────────────────────────────────────────────────
  // Poblados desde x-pos-user (desarrollo) o JWT (producción).
  // Vacíos cuando se usa el path M2406 legacy.

  /** RUT del usuario sin DV (ej: '18373061') */
  RutUsuario: string;
  /** RUT con DV concatenado (ej: '183730614') */
  RutUsuarioDV: string;
  /** Nombre completo del usuario */
  NombreUsuario: string;
  /** Identificador de perfil (ej: 'posadmcert', 'CAJERAADMINISTRATIVA') */
  Perfil: string;
  /** Descripción legible del perfil */
  PerfilDesc: string;
  /** Mandante / empresa matriz (ej: '76407930') */
  Mandante: string;
  /** RUT de la empresa (ej: '500000023') */
  RutEmpresa: string;
  /** Sucursal del usuario (puede ser cadena vacía) */
  Sucursal: string;
}
