import { Injectable } from '@nestjs/common';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';

export interface BalanzaContexto {
  ctx: IPosContext;
  notaVentaKey: number;
}

/**
 * Contexto activo de la balanza física conectada a este terminal POS.
 *
 * El listener de hardware (BalanzaListenerService) corre fuera del ciclo
 * HTTP y no tiene acceso a PosContextGuard, por lo que el frontend le
 * informa el contexto vigente (EmpKey/PuntoAccesoKey/NotaVentaKey) vía
 * WebSocket apenas abre la pantalla de venta. Un mismo proceso Node
 * atiende un único dispositivo de hardware — basta un slot en memoria.
 */
@Injectable()
export class BalanzaContextStore {
  private actual: BalanzaContexto | null = null;

  set(contexto: BalanzaContexto): void {
    this.actual = contexto;
  }

  get(): BalanzaContexto | null {
    return this.actual;
  }

  clear(): void {
    this.actual = null;
  }
}
