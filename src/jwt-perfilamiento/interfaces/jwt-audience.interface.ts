import type { PIItem } from './pi-item.interface.js';
import type { CanalItem } from './canal-item.interface.js';

/** Claim `aud` — identidad del holder (usuario) que emite Perfilamiento. */
export interface JWTAudience {
  AgenteKey: number;
  AgenteName: string;
  AgenteLastName: string;
  PI: PIItem[];
  Canal?: CanalItem[];
}
