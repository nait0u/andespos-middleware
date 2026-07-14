import type { GxMessage } from '../../../common/interfaces/parameter.interfaces.js';

// ================================================================
//  BuscarProductoOmnibox
// ================================================================

/**
 * Respuesta cruda de BuscarProductoOmnibox. El yaml declara el campo como
 * "ModalidaVenta" (typo de GeneXus — falta la "d" de "Modalidad"); se
 * preserva tal cual para el parseo y se corrige al exponerlo al frontend
 * como `modalidadVenta` en ProductoResolucionDto.
 */
export interface GxBuscarProductoOmniboxResponse {
  ProductoKey: number;
  ModalidaVenta: number;
  UsaLote: boolean;
  VendeLote: boolean;
  LoteUnicoKey: number;
  Messages: GxMessage[];
}

export interface ProductoResolucionDto {
  productoKey: number;
  modalidadVenta: number;
  usaLote: boolean;
  vendeLote: boolean;
  /** Si es > 0, el lote puede resolverse automáticamente sin pedirle selección al cajero */
  loteUnicoKey: number;
}

// ================================================================
//  GetLotesPorProducto
// ================================================================

export interface GxLoteItem {
  LoteKey: number;
  LoteCodigo: string;
  LoteCaducaFecha: string;
  CantidadInventario: number;
}

export interface GxGetLotesPorProductoResponse {
  SDTLoteList: GxLoteItem[];
  Messages: GxMessage[];
}

export interface LoteProductoDto {
  loteKey: number;
  loteCodigo: string;
  loteCaducaFecha: string;
  cantidadInventario: number;
}
