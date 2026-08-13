/**
 * Nombre del repositorio Redis donde `SetsessionService` persiste las sesiones
 * creadas desde el JWT de Perfilamiento, y que `PosContextGuard` (PATH C) lee
 * para poblar el contexto POS. Centralizado acá porque ambos lo necesitan y
 * ninguno debe depender del otro directamente.
 */
export const REPOSITORIO_SESIONES_PERFILAMIENTO = 'SesionesPerfilamiento';

export const COOKIE_SESSION_ID = 'pos-session-id';
