import type { GxMessage } from '../../../common/interfaces/parameter.interfaces.js';

/**
 * Respuesta de POS/AI_API/Venta/xVenta/GetEstadoCaja
 */
export interface GxEstadoCajaResponse {
  EsCaja: boolean;
  TurnoCajaKey: number;
  EstadoCaja: string;
  UsaMesas: boolean;
  RequiereClientePreVenta: boolean;
  Messages: GxMessage[];
}

/**
 * Item individual en el listado de ventas (xVenta/GetListaVentas)
 */
export interface GxVentaXVentaItem {
  NotaVentaKey: number;
  NotaVentaFecha: string;
  NotaVentaTiempo: string;
  ClienteNombreCompleto: string;
  NotaVentaEstado: string;
  NotaVentaFolioTri: number;
  NotaVentaGlosa: string;
}

/**
 * Respuesta de POS/AI_API/Venta/xVenta/GetListaVentas
 * TimeStamp debe persistirse como SyncTimeStamp en el próximo ciclo de delta-sync.
 */
export interface GxListaVentasXVentaResponse {
  SDTVentas: GxVentaXVentaItem[];
  TimeStamp: string;
  Messages: GxMessage[];
}

/**
 * Respuesta de POS/AI_API/Venta/xVenta/CrearNuevaVenta
 */
export interface GxCrearNuevaVentaResponse {
  NotaVentaKey: number;
  Messages: GxMessage[];
}

/**
 * Respuesta de POS/AI_API/Venta/xInitVenta/AnularVenta
 */
export interface GxAnularVentaXVentaResponse {
  Messages: GxMessage[];
}

// ================================================================
//  xVenta — Pantalla Venta
// ================================================================

export interface GxPantallaVentaInitSettings {
  UsaLectorQR: boolean;
  PermiteCotizar: boolean;
  LargoMinimoCodigo: number;
  TipoDocumentoDefecto: string;
  UsaComanda: boolean;
  UsaProductoLibre: boolean;
  VentasGuiasDespacho: boolean;
  ModificaPrecioOk: boolean;
  ModificaDescuentoOk: boolean;
}

export interface GxPantallaVentaInitPermisos {
  PuedeActualizar: boolean;
  RecibePagos: boolean;
  EditaVendedor: boolean;
  EditaGlosa: boolean;
  TomaPedidoOk: boolean;
  DespachoOk: boolean;
}

export interface GxPantallaVentaInitMetodosDePago {
  EfectivoOk: boolean;
  TarjetaOk: boolean;
  ConvenioOk: boolean;
  TransferenciaOk: boolean;
  ChequeOk: boolean;
  CreditoOk: boolean;
}

export interface GxPantallaVentaInitReglaDeNegocio {
  ExigeVendedorOk: boolean;
  ChequeClienteExige: boolean;
}

export interface GxPantallaVentaInitEstado {
  NotaVentaEstado: string;
  IsEditable: boolean;
  RedirectURI: string;
  EmiteBoletaNormalOk: boolean;
  CantidadComandasPendientes: number;
  ImprimirComandasPendientesOk: boolean;
}

export interface GxPantallaVentaInitActores {
  ClienteKey: number;
  ClienteNombreCompleto: string;
  ClienteGiro: string;
  VendedorKey: number;
  VendedorApodo: string;
  VendedorEditOk: boolean;
}

export interface GxPantallaVentaInitUIFlags {
  PermiteEmitirGuiaVenta: boolean;
  PermiteEmitirFactura: boolean;
  PermiteEmitirBoleta: boolean;
  PermiteEmitirTicketOk: boolean;
  PermiteEmitirTicketNoTriOk: boolean;
  PermiteEmitirGuiaTraslado: boolean;
  PermiteAgregarReferencia: boolean;
  PermiteDatosTransportista: boolean;
  MuestraDescuentoGlobalOk: boolean;
  VistaInicial: string;
  MuestraCatBuscadoraOk: boolean;
  MuestraTotalPagosOk: boolean;
  MuestraTotalVueltoOk: boolean;
  MuestraTotalBrutoOk: boolean;
  PermiteEditarTipoDocTriOk: boolean;
}

export interface GxSDTPantallaVentaInit {
  Settings: GxPantallaVentaInitSettings;
  Permisos: GxPantallaVentaInitPermisos;
  MetodosDePago: GxPantallaVentaInitMetodosDePago;
  ReglaDeNegocio: GxPantallaVentaInitReglaDeNegocio;
  Estado: GxPantallaVentaInitEstado;
  Actores: GxPantallaVentaInitActores;
  UIFlags: GxPantallaVentaInitUIFlags;
}

/**
 * Respuesta de POS/AI_API/Venta/xVenta/GetPantallaVentaInit
 */
export interface GxPantallaVentaInitResponse {
  SDTPantallaVentaInit: GxSDTPantallaVentaInit;
  Messages: GxMessage[];
}

export interface GxVentaTotalesMontos {
  TotalBruto: number;
  TotalPagos: number;
  Vuelto: number;
  TotalLista: number;
  VueltoLista: number;
  TotalAMostrar: number;
}

export interface GxVentaTotalesEstadoCarrito {
  ExisteProductoOk: boolean;
  TieneItemLibreOk: boolean;
  TieneProductoTabOk: boolean;
  ExisteProductoXEncargarDeliveryOk: boolean;
}

export interface GxVentaTotalesFlags {
  MostrarTotalOk: boolean;
  MostrarPagosOk: boolean;
  MostrarVueltoOk: boolean;
  MostrarBtnPagosOk: boolean;
}

export interface GxSDTVentaTotales {
  Montos: GxVentaTotalesMontos;
  EstadoCarrito: GxVentaTotalesEstadoCarrito;
  Flags: GxVentaTotalesFlags;
}

/**
 * Respuesta de POS/AI_API/Venta/xVenta/GetPantallaVentaTotales
 */
export interface GxVentaTotalesResponse {
  SDTVentaTotales: GxSDTVentaTotales;
  Messages: GxMessage[];
}

export interface GxVentaCarritoSync {
  TimeStamp: string;
}

export interface GxVentaCarritoItem {
  Linea: number;
  ProductoKey: number;
  CodigoInterno: string;
  Descripcion: string;
  UnidadMedida: string;
  Cantidad: number;
  Precio: number;
  DescuentoMonto: number;
  TotalItem: number;
  EsNoFacturableOk: boolean;
  EditaGlosaOk: boolean;
  EsAnuladoOk: boolean;
  EsDescuentoOk: boolean;
}

export interface GxVentaCarritoLineaEliminada {
  LineaEliminadaItem: number;
}

export interface GxSDTVentaCarrito {
  Sync: GxVentaCarritoSync;
  ItemsActualizados: GxVentaCarritoItem[];
  LineasEliminadas: GxVentaCarritoLineaEliminada[];
}

/**
 * Respuesta de POS/AI_API/Venta/xVenta/GetPantallaVentaCarrito
 */
export interface GxVentaCarritoResponse {
  SDTVentaCarrito: GxSDTVentaCarrito;
  Messages: GxMessage[];
}

// ================================================================
//  xVenta — Catálogo / Carta Touch
// ================================================================

export interface GxCartaTouchProductoItem {
  ProductoKey: number;
  ProductoCodigo: string;
  ProductoDescripcion: string;
  ProductoUnidadMedida: string;
  ProductoUnidadMedida2a: string;
  ProductoTratamientoTributario: string;
  ProductoActEcoCod: number;
  ProductoActEcoDescripcion: string;
  ProductoStock: number;
  ProductoPrecios: string;
  ProductoModalidadVenta: number;
  ProductoTieneStock: boolean;
  ProductoVendeLote: boolean;
  ItemInformacionAdicional: string;
}

export interface GxCartaTouchGrupoItem {
  GrupoSelectorIdentificador: string;
  GrupoSelectorDescripcion: string;
  GrupoSelectorTouchSelector: boolean;
  GrupoSelectorOrden: number;
  Productos: GxCartaTouchProductoItem[];
}

export interface GxSDTCartaVenta {
  CartaGrupos: GxCartaTouchGrupoItem[];
}

/**
 * Respuesta de POS/AI_API/Venta/xVenta/GetCartaTouchInicial
 */
export interface GxCartaTouchResponse {
  SDTCartaVenta: GxSDTCartaVenta;
  Messages: GxMessage[];
}

// ================================================================
//  xVenta — Detalle Producto
// ================================================================

export interface GxDetalleProductoStockItem {
  PuntoAccesoDescripcion: string;
  ProductoStockCantidadInventario: number;
  PuntoAccesoStockLocalizacion: string;
}

export interface GxDetalleProductoGlosaTecnicaItem {
  CategoriaNombre: string;
  PropiedadDescripcion: string;
  PropiedadValor: string;
}

export interface GxSDTDetalleProductoVenta {
  MItemNom: string;
  ImagenesURI: string;
  StockXLocalizacion: GxDetalleProductoStockItem[];
  GlosaTecnica: GxDetalleProductoGlosaTecnicaItem[];
}

/**
 * Respuesta de POS/AI_API/Venta/xVenta/GetProductoDetallesVenta
 */
export interface GxProductoDetallesResponse {
  SDTDetalleProductoVenta: GxSDTDetalleProductoVenta;
  Messages: GxMessage[];
}

// ================================================================
//  xVenta — Selector Producto General
// ================================================================

/**
 * Item de Operaciones.mNotaVenta.ProductosSelectorProductoBusca.
 * PrecioPicture/CantidadPicture son strings "Picture" de GeneXus — ya vienen
 * formateados para mostrar (con separador de miles/moneda) y NO deben
 * pasarse por Number(): un `Number()` sobre un Picture con formato produce
 * NaN, no el valor real.
 */
export interface GxSelectorProductoGeneralItem {
  EmpKey: number;
  ProductoKey: number;
  TipoCodDes: string;
  MItemCodVal: string;
  ProductoDescripcion: string;
  PrecioPicture: string;
  CantidadPicture: string;
  MItemPropiaUniItmId_: string;
  ProductoVendeLote: boolean;
  ItemInformacionAdicional: string;
}

/**
 * Respuesta de POS/AI_API/Venta/xVenta/GetSelectorProductoGeneral
 */
export interface GxSelectorGeneralResponse {
  MostrarBotonVer: boolean;
  SDTSelectorProductoGeneral: GxSelectorProductoGeneralItem[];
  Messages: GxMessage[];
}

// ================================================================
//  xVenta — Categorías Menú
// ================================================================

export interface GxCategoriaItem {
  CatCod: string;
  CatNom: string;
}

/**
 * Respuesta cruda de POS/AI_API/Venta/xVenta/GetCategoriasMenu
 */
export interface GxCategoriasMenuResponse {
  ColClasificadoras: GxCategoriaItem[];
  ColBuscadoras: GxCategoriaItem[];
  Messages: GxMessage[];
}

/** Snapshot almacenado en caché — incluye el timestamp del momento del fetch */
export interface GxCategoriasMenuCacheEntry {
  data: GxCategoriasMenuResponse;
  fetchedAt: string;
}

/**
 * Respuesta paginada que expone el BFF para GetCategoriasMenu
 */
export interface GxCategoriasMenuPaginadoResponse {
  ColClasificadoras: GxCategoriaItem[];
  ColBuscadoras: GxCategoriaItem[];
  TotalClasificadoras: number;
  TotalBuscadoras: number;
  SyncTimeStamp: string;
  Messages: GxMessage[];
}

// ================================================================
//  xVenta — Filtro Categorias
// ================================================================

/**
 * Item de Operaciones.mNotaVenta.Items.ProductosCasificadorasBuscadoras.
 * A diferencia de GxSelectorProductoGeneralItem, acá PrecioItem/Stock SÍ
 * son numéricos crudos (no Picture) — GetSelectorFiltroCategorias devuelve
 * un shape completamente distinto a GetSelectorProductoGeneral pese a que
 * antes ambos endpoints compartían el mismo SDT.
 */
export interface GxProductoCasificadoraBuscadoraItem {
  EmpKey: number;
  MItemKey: number;
  MItemNom: string;
  Codigo: string;
  Categoria: string;
  PrecioItem: number;
  Stock: number;
}

/**
 * Respuesta de POS/AI_API/Venta/xVenta/GetSelectorFiltroCategorias
 */
export interface GxFiltroCategoriasResponse {
  MostrarBotonVer: boolean;
  SDTSelectorCategorias: GxProductoCasificadoraBuscadoraItem[];
  Messages: GxMessage[];
}
