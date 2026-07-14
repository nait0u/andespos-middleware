/** Configuracion leida desde parms202501.xml */
export interface ParameterConfig {
  hostname: string;
  port: number;
  basePath: string;
  secure: boolean;
  timeout: number;
}

/** Mensaje estandar de respuesta GeneXus */
export interface GxMessage {
  Id: string;
  Type: number;
  Description: string;
}

/** Respuesta base de cualquier servicio GeneXus */
export interface GxBaseResponse {
  Messages: GxMessage[];
  Ok: boolean;
}

/** SDT de GeneXus: valores de parametros de aplicacion (estructura raw de la API) */
export interface SDTParametrosValuesApp extends GxBaseResponse {
  ParametrosValuesApp: {
    ParametroValueArray: ParametroValorResultado[];
  };
}

/** Cada item de valor de parametro retornado por GeneXus */
export interface ParametroValorResultado {
  ParametroId: string;
  ParametroJerarquia: string;
  Persistencia: string;
  ValorInstanciado: boolean;
  ValorJerarquia: string;
  ValorParametroFin: string;
  ValorParametroIni: string;
  ValorParametroValor: string;
}

/** SDT de GeneXus: definiciones de parametros de aplicacion */
export interface SDTParametrosDefinitionApp extends GxBaseResponse {
  ParametrosDefinitionApp: ParametroDefinicionItem[];
}

/** Cada item de definicion de parametro */
export interface ParametroDefinicionItem {
  ParametroId: string;
  ParametroNombre: string;
  ParametroDescripcion: string;
  ParametroTipo: string;
}

/** SDT de GeneXus: definiciones de parametros por lista */
export interface SDTParametrosDefinicion extends GxBaseResponse {
  SDTParametrosDefinicion: ParametroDefinicionItem[];
}

/** SDT de GeneXus: estructuras de parametros */
export interface SDTParametroEstructura extends GxBaseResponse {
  SDTParametroEstructura: ParametroEstructuraItem[];
}

/** Cada item de estructura de parametro */
export interface ParametroEstructuraItem {
  EstructuraId: string;
  EstructuraNombre: string;
  EstructuraDescripcion: string;
}

/** Parametros de consulta para GetParametrosValues */
export interface ParameterValuesParams {
  Empkey?: number;
  ParametroId?: string;
  AlcanceId?: string;
  AmbienteId?: string;
  Aplicacion_Idl?: string;
  StringIds?: string;
  Modo?: string;
}

/** Parametros de consulta para GetParametroDefinicion */
export interface ParameterDefinitionParams {
  Aplicacion_Idl: string;
  Modo?: string;
}

/** Parametros de consulta para GetDefinicionParametros */
export interface DefinicionParametrosParams {
  Listaparametros: string;
  Token?: string;
}

/** Body para SetParametrosValues (POST) */
export interface SetParametrosValuesBody {
  EmpKey: number;
  AlcanceId: string;
  AmbienteId: string;
  AplicacionIdl: string;
  ListaParametroValorV2: {
    ParametroValor: ParametroValorItem[];
  };
  Modo?: string;
}

/** Cada item de valor de parametro para SET */
export interface ParametroValorItem {
  ParametroID: string;
  ParametroDefecto: boolean;
  ActualValorParametroInicio: string;
  ActualValorParametroFin: string;
  ActualValorParametroValor: string;
  ValorParametroValor: string;
  ValorParametroInicio: string;
  ValorParametroFin: string;
  Accion: string;
  TipoBaja: string;
}

/** Resultado de persistencia con validacion de vigencia (TTL) */
export interface PersistenciaConVigencia {
  contenido: string;
  vigente: boolean;
}
