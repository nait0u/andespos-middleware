export const ENV_PUBLIC_KEY_URL = 'JWT_PERFILAMIENTO_PUBLIC_KEY_URL';
export const ENV_PUBLIC_KEY_PATH = 'JWT_PERFILAMIENTO_PUBLIC_KEY_PATH';
export const ENV_CLOCK_GRACE_SECONDS = 'JWT_PERFILAMIENTO_CLOCK_GRACE_SECONDS';

/** Tolerancia simétrica default sobre nbf/exp (doc §3.2: "1 minuto de tolerancia"). */
export const DEFAULT_CLOCK_GRACE_SECONDS = 60;

/** TTL de cache en memoria de la clave pública remota (doc §6: "TTL 1 hora"). */
export const PUBLIC_KEY_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Nombre de issuer esperado, pineado (claim `iss.Nombre`, doc §3.2). El doc usa
 * "AC-Perfilamiento" como nombre ilustrativo; el valor real observado en tokens
 * de producción de Perfilamiento (Enternet/GeneXus) es este. Se pinea a
 * propósito (no se lee de config) — es un control de seguridad, no un dato.
 */
export const ISSUER_NOMBRE_ESPERADO = 'LanzaderaPerfilamientoEnternet';

/** Raíz de alcance que se trata como "empresa" para los alias de conveniencia (§5.2). */
export const RAIZ_ALCANCE_EMPRESA = 'Empresa';
