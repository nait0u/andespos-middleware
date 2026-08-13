/**
 * Diccionario de variables de sesión resultante (doc §5). Los campos fijos del
 * holder/perfil siempre están presentes; el resto de las claves provienen de
 * resolver genéricamente cada alcance del token contra su template (§3.4) —
 * su presencia depende de lo que Perfilamiento incluya en cada emisión.
 */
export interface SessionVariables {
  /** RUT completo del usuario (con DV), 9 chars. */
  _RUTUSU: string;
  /** RUT sin DV (8 chars). */
  RUTNODV: string;
  /** Dígito verificador del RUT. */
  RUTDV: string;
  /** Nombre completo (AgenteName + AgenteLastName). */
  _NOMUSU: string;
  /** Correo del usuario. */
  _CORREO: string;
  /** Código de perfil (identificador lógico estable). */
  _NOTPERFIL: string;
  /** Descripción del perfil. */
  _NOTPERFILDES: string;
  /** Nodo raíz / módulo de entrada, si se recibió el parámetro. */
  _NODORAIZ: string;
  /** Alias de _NODORAIZ. */
  PARAMETROENTRADA: string;
  /** URL de reingreso a Perfilamiento para re-elegir rol, si vino en el token. */
  CHGROLURI: string | null;
  /**
   * Alcances resueltos genéricamente: una entrada por cada raíz de alcance
   * distinta encontrada en el token, con sus etiquetas ya emparejadas a valor
   * (p. ej. `{ EmpresaKey: '1234', EmpresaRut: '...', EmpresaNombre: '...' }`
   * bajo la clave de raíz `Empresa`).
   */
  alcances: Record<string, Record<string, string>>;
  /** Alias planos de conveniencia, presentes solo si hay alcance de empresa. */
  EmpresaKey?: string;
  empkey?: string;
  _EmpKey?: string;
  EmpresaRut?: string;
  EmpresaNombre?: string;
}
