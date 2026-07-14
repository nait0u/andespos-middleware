import type { GxMessage } from '../../../common/interfaces/parameter.interfaces.js';

export interface GxCodigoComboBoxItem {
  Codigo: string;
  Descripcion: string;
}

/** Respuesta cruda de todos los GetCatalogo* de xVenta (mismo shape) */
export interface GxCatalogoResponse {
  SDTCatalogo: GxCodigoComboBoxItem[];
  Messages: GxMessage[];
}

export interface CatalogoItemDto {
  codigo: string;
  descripcion: string;
}
