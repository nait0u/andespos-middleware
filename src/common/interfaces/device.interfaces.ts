/** Configuracion leida desde LocationAdministradorDispositivos.txt */
export interface DeviceConfig {
  host: string;
  port: number;
  baseUrl: string;
  timeout: number;
  secure: boolean;
}

/** Empresa asociada al dispositivo (item de EnEmpresa[]) */
export interface SDTDispositivoEnEmpresa {
  EmpKey: number;
  EmpRutEmi: string;
  DispositivoEnEmpresaNombre: string;
  DispositivoEnEmpresaFechaInicio: string;
  DispositivoEnEmpresaFechaFin: string;
  DispositivoEnEmpresaFechaFinEf: string;
  DispositivoEnEmpresaEstado: string;
}

/** SDT de GeneXus: informacion completa del dispositivo (APIPareo/GetDispositivoInformacion) */
export interface SDTDispositivoInformacion {
  DispositivoId: string;
  DispositivoNombre: string;
  DispositivoType: string;
  DispositivoEstado: string;
  AmbienteId: string;
  DispositivoServerName: string;
  EnEmpresa: SDTDispositivoEnEmpresa[];
  Aplicacion: Record<string, unknown>[];
}

/** Resultado de la validacion de un token */
export interface TokenValidationResult {
  valido: boolean;
  mensaje: string;
  dispositivoId: string;
}

/** Respuesta del servicio GetDispositivoClave de GeneXus */
export interface DeviceClaveResponse {
  DispositivoClave?: string;
  Password?: string;
  password?: string;
}

/** Respuesta del servicio GetDispositivoInformacion de GeneXus */
export interface DeviceInformacionResponse {
  DispositivoInformacion?: string;
}
