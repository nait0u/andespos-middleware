export type OmniboxAction =
  | 'CART_MUTATED'
  | 'OPEN_SEARCH_GRID'
  | 'OPEN_QR_MODAL'
  | 'REQUIRE_LOTE'
  | 'ERROR';

/** Contrato de respuesta único del OmniBox — React reacciona vía switch/reducer sobre `action`. */
export interface OmniboxResponseDto {
  action: OmniboxAction;
  payload?: unknown;
  message?: string;
}
