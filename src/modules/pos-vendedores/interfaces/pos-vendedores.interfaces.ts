import type { GxMessage } from '../../../common/interfaces/parameter.interfaces.js';

export interface GxVendedorListItem {
  UsuarioKey: number;
  UsuarioApodo: string;
  UsuarioPIValor: string;
  UsuarioNombreCompleto: string;
}

export interface GxGetVendedoresResponse {
  SDTVendedorList: GxVendedorListItem[];
  Messages: GxMessage[];
}

export interface VendedorListItemDto {
  usuarioKey: number;
  usuarioApodo: string;
  usuarioPIValor: string;
  usuarioNombreCompleto: string;
}
