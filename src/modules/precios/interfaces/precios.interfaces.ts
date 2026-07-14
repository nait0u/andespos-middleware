import type { GxMessage } from '../../../common/interfaces/parameter.interfaces.js';

// ── SDT items ────────────────────────────────────────────────────────────────

export interface GxPrecioItem {
  Empkey: number;
  ProductoKey: number;
  CodIntValor: string;
  ProductoDescripcion: string;
  PrecioTimeInicio: string;
  PrecioTimeFin: string;
  PrecioHoraInicio: string;
  PrecioHoraFin: string;
  PrecioUbiCod: string;
  Ubinom: string;
  CategoriaPrecioIdl: string;
  PrecioCantidad: number;
  PrecioItem: number;
  PrecioDescuentoPorcentaje: number;
  PrecioDescuentoMax: number;
  PrecioUnidadMedida: string;
}

export interface GxProductoSearchItem {
  ProductoKey: number;
  TipoCodDes: string;
  MItemCodVal: string;
  ProductoDescripcion: string;
}

export interface GxUbicacionItem {
  UbiCod: string;
  UbiNom: string;
}

export interface GxFormatoItem {
  Id: string;
  Descripcion: string;
}

export interface GxCategoriaPrecioItem {
  CategoriaPrecioIdl: string;
  CategoriaPrecioDescripcion: string;
  CategoriaPrecioTipo: string;
}

// ── Respuestas GeneXus xListaDePrecios ──────────────────────────────────────

export interface GxGetPreciosResponse {
  ListaPreciosSDT: GxPrecioItem[];
  TimeStamp: string;
  Messages: GxMessage[];
}

export interface GxGetNovedadesResponse {
  ListaPreciosSDT: GxPrecioItem[];
  TimeStampOut: string;
  Messages: GxMessage[];
}

export interface GxCaducarPrecioResponse {
  Mensaje: string;
  Ok: boolean;
  Messages: GxMessage[];
}

export interface GxCrearPrecioResponse {
  Mensaje: string;
  Messages: GxMessage[];
}

export interface GxGuardarPrecioResponse {
  Mensaje: string;
  Messages: GxMessage[];
}

export interface GxUploadPreciosResponse {
  Mensaje: string;
  Messages: GxMessage[];
}

export interface GxGetProductosBuscadorResponse {
  ProductoSearchSDT: GxProductoSearchItem[];
  Messages: GxMessage[];
}

export interface GxGetUbicacionesResponse {
  UbicacionesComboSDT: GxUbicacionItem[];
  Messages: GxMessage[];
}

export interface GxGetFormatosUploadResponse {
  FormatosList: GxFormatoItem[];
  Messages: GxMessage[];
}

export interface GxGetCategoriasPrecioResponse {
  CategoriaPrecioSDT: GxCategoriaPrecioItem[];
  Messages: GxMessage[];
}
