import type { SessionVariables } from '../../jwt-perfilamiento/index.js';

/**
 * Forma persistida en Redis por `SetsessionService` y leída por
 * `PosContextGuard` (PATH C) — contrato compartido entre ambos.
 */
export interface SesionPerfilamientoPersistida {
  sessionVariables: SessionVariables;
  jti: string;
  expISO: string;
}
