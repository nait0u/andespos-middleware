import type { GxMessage } from '../../../common/interfaces/parameter.interfaces.js';

// ================================================================
//  GetClientes
// ================================================================

export interface GxClienteListItem {
  ClienteKey: number;
  ClienteRUT: string;
  ClienteNombreCompleto: string;
  ClienteGiro: string;
  ClienteAddress: string;
}

export interface GxGetClientesResponse {
  SDTClienteList: GxClienteListItem[];
  Messages: GxMessage[];
}

export interface ClienteListItemDto {
  clienteKey: number;
  clienteRUT: string;
  clienteNombreCompleto: string;
  clienteGiro: string;
  clienteAddress: string;
}

// ================================================================
//  CrearClienteShell
// ================================================================

export interface GxCrearClienteShellResponse {
  ClienteKey: number;
  Messages: GxMessage[];
}

// ================================================================
//  CopiarCliente
// ================================================================

export interface GxCopiarClienteResponse {
  ClienteKeyNew: number;
  Messages: GxMessage[];
}

/** ActualizarCliente devuelve solo Messages (array plano) */
export type GxMessagesOnlyResponse = GxMessage[];
