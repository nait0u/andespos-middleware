import type { GxMessage } from '../../../common/interfaces/parameter.interfaces.js';

export type {
  GxCarritoDeltaResponse,
  DeltaCarritoResponseDto,
} from '../../../common/interfaces/venta-carrito-delta.interfaces.js';

/** EditarGlosaCabecera / AsignarVendedor / GuardarTransportista / SincronizarReferencias devuelven solo Messages */
export type GxMessagesOnlyResponse = GxMessage[];

export interface GxAsignarClienteResponse {
  CategoriaIdl: string;
  Messages: GxMessage[];
}
