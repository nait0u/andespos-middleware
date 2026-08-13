import type { JWTAudience } from './jwt-audience.interface.js';
import type { JWTRol } from './jwt-rol.interface.js';

/**
 * Modelo mapeado del JWT de Perfilamiento (payload crudo → tipado).
 * `iat` se conserva solo para exponerlo tal cual vía getters (§5.4) — no es
 * confiable para ninguna validación de vigencia (viene con offset UTC-4
 * estampado como UTC en producción).
 */
export interface AuthzJWT {
  issuerNombre: string;
  aud: JWTAudience;
  rol: JWTRol;
  jti: string;
  asignacion: number | null;
  iatISO: string;
  nbfISO: string;
  expISO: string;
  reentryUrl: string | null;
  jwt: string;
}
