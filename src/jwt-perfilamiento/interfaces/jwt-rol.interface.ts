import type { AlcanceItem } from './alcance-item.interface.js';
import type { AtribucionItem } from './atribucion-item.interface.js';

/** Claim `Rol` — rol/perfil con el que entra el usuario, más su contexto y permisos. */
export interface JWTRol {
  RolName: string;
  RolKey: number;
  PerfilIdL: string;
  PerfilName: string;
  PerfilDescripcion: string;
  Alcance: AlcanceItem[];
  Atribucion: AtribucionItem[];
}
