import type { GxMessage } from './parameter.interfaces.js';

// ================================================================
//  Delta (SDTVentaCarrito) + Totales — shape crudo devuelto por GeneXus
//  en toda mutación transaccional de xVenta (AgregarProductoCarrito,
//  EliminarLineaCarrito, AgregarBalanzaCarrito, EditarGlosaLinea,
//  AplicarDescuentoGlobal, etc.)
// ================================================================

export interface GxVentaCarritoItemDelta {
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

export interface GxSDTVentaCarritoDelta {
  Sync: { TimeStamp: string };
  ItemsActualizados: GxVentaCarritoItemDelta[];
  LineasEliminadas: GxVentaCarritoLineaEliminada[];
}

export interface GxSDTVentaTotales {
  Montos: {
    TotalBruto: number;
    TotalPagos: number;
    Vuelto: number;
    TotalLista: number;
    VueltoLista: number;
    TotalAMostrar: number;
  };
  EstadoCarrito: {
    ExisteProductoOk: boolean;
    TieneItemLibreOk: boolean;
    TieneProductoTabOk: boolean;
    ExisteProductoXEncargarDeliveryOk: boolean;
  };
  Flags: {
    MostrarTotalOk: boolean;
    MostrarPagosOk: boolean;
    MostrarVueltoOk: boolean;
    MostrarBtnPagosOk: boolean;
  };
}

export interface GxCarritoDeltaResponse {
  SDTVentaCarrito: GxSDTVentaCarritoDelta;
  SDTVentaTotales: GxSDTVentaTotales;
  Messages: GxMessage[];
}

// ================================================================
//  Shape plano expuesto al frontend
// ================================================================

export interface DeltaCarritoDto {
  sync: { timeStamp: string };
  itemsActualizados: {
    linea: number;
    productoKey: number;
    codigoInterno: string;
    descripcion: string;
    unidadMedida: string;
    cantidad: number;
    precio: number;
    descuentoMonto: number;
    totalItem: number;
    esNoFacturableOk: boolean;
    editaGlosaOk: boolean;
    esAnuladoOk: boolean;
    esDescuentoOk: boolean;
  }[];
  lineasEliminadas: { lineaEliminadaItem: number }[];
}

export interface TotalesDto {
  montos: {
    totalBruto: number;
    totalPagos: number;
    vuelto: number;
    totalLista: number;
    vueltoLista: number;
    totalAMostrar: number;
  };
  estadoCarrito: {
    existeProductoOk: boolean;
    tieneItemLibreOk: boolean;
    tieneProductoTabOk: boolean;
    existeProductoXEncargarDeliveryOk: boolean;
  };
  flags: {
    mostrarTotalOk: boolean;
    mostrarPagosOk: boolean;
    mostrarVueltoOk: boolean;
    mostrarBtnPagosOk: boolean;
  };
}

export interface DeltaCarritoResponseDto {
  carrito: DeltaCarritoDto;
  totales: TotalesDto;
}
