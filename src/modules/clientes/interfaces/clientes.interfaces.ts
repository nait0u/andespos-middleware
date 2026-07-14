import type { GxMessage } from '../../../common/interfaces/parameter.interfaces.js';

// ============================================================================
//  GuardarCliente
// ============================================================================

export interface IGenexusGuardarClienteResponse {
  ClienteKeyOut: number;
  Messages: GxMessage[];
}

export interface IGuardarClienteResponse {
  clienteKey: number;
  mensaje: string;
}

// ============================================================================
//  GetListaClientesPreVenta
// ============================================================================

/**
 * Item crudo tal como lo devuelve GeneXus dentro de SDTClientesLista.
 * El SDT está mal tipado en GX (apunta a Errores.Lista) — los campos reales
 * son los del SDTClienteEntrada/Salida del procedure. Casing PascalCase.
 */
export interface IGxClienteListaItem {
  ClienteKey: number;
  ClientePITipo?: string;
  ClientePIValor?: string;
  ClienteRUT?: string;
  /** Nombre combinado que devuelve GetListaClientesPreVenta. */
  ClienteNombreCompleto?: string;
  ClienteRazonSocial?: string;
  ClienteNombre?: string;
  ClienteApellidoPaterno?: string;
  ClienteApellidoMaterno?: string;
  ClienteGiro?: string;
  ClienteEmail?: string;
  ClienteHomePhone?: string;
  ClienteMobilPhone?: string;
  ClienteAddress?: string;
  ClienteComunaId?: string;
  ClienteRetieneImpuestos?: string;
  CategoriaPrecioIdl?: string;
  ClienteMatrizKey?: number;
  [extra: string]: unknown;
}

export interface IGenexusListaClientesResponse {
  SDTClientesLista?: IGxClienteListaItem[];
  Messages?: GxMessage[];
}

/**
 * Shape consumible por el front (camelCase plano). Mantener nombres
 * alineados con el modelo Customer del POS.
 */
export interface IClienteListaItem {
  clienteKey: number;
  clientePITipo?: string;
  clientePIValor?: string;
  clienteRUT?: string;
  /** Nombre combinado tal como viene de GetListaClientesPreVenta. */
  clienteNombreCompleto?: string;
  clienteRazonSocial?: string;
  clienteNombre?: string;
  clienteApellidoPaterno?: string;
  clienteApellidoMaterno?: string;
  clienteGiro?: string;
  clienteEmail?: string;
  clienteHomePhone?: string;
  clienteMobilPhone?: string;
  clienteAddress?: string;
  clienteComunaId?: string;
  /** Booleano normalizado por el BFF (GX devuelve "S"/"N"). */
  clienteRetieneImpuestos?: boolean;
  categoriaPrecioIdl?: string;
  clienteMatrizKey?: number;
}

export interface IListaClientesResponse {
  clientes: IClienteListaItem[];
}

// ============================================================================
//  GetComunas — response es un array directo (no envuelto en SDTComunas)
// ============================================================================

export interface IGxComunaItem {
  ComunaId: string;
  ComunaNombre: string;
  ComunaCiudad: string;
}

export interface IComunaItem {
  comunaId: string;
  comunaNombre: string;
  comunaCiudad: string;
}

export interface IComunasResponse {
  comunas: IComunaItem[];
}

// ============================================================================
//  GetCategoriasPrecio — response es un array directo
// ============================================================================

export interface IGxCategoriaPrecioItem {
  CategoriaPrecioIdl: string;
  CategoriaPrecioTipo: string;
}

export interface ICategoriaPrecioItem {
  categoriaPrecioIdl: string;
  categoriaPrecioTipo: string;
}

export interface ICategoriasPrecioResponse {
  categorias: ICategoriaPrecioItem[];
}

// ============================================================================
//  GetClienteMatriz
// ============================================================================

export interface IGenexusClienteMatrizResponse {
  RequiereSubordinacionOk?: boolean;
  ClienteMatrizKey?: number;
  Messages?: GxMessage[];
}

export interface IClienteMatrizResponse {
  /** Indica si el cliente requiere subordinación (jerarquía matriz/sucursal). */
  requiereSubordinacionOk: boolean;
  /** Key de la matriz. 0 si no aplica/no encontrado. */
  clienteMatrizKey: number;
}