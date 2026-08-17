import type { SessionVariables } from '@andestec/jwt-perfilamiento';

/**
 * Forma persistida en Redis por `SetsessionService` y leída por
 * `PosContextGuard` (PATH C) — contrato compartido entre ambos.
 */
export interface SesionPerfilamientoPersistida {
  sessionVariables: SessionVariables;
  jti: string;
  expISO: string;
}
