import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IPosContext } from '../interfaces/pos-context.interface.js';

export type { IPosContext };

/**
 * Extrae limpiamente el IPosContext del request, inyectado previamente
 * por PosContextGuard durante el Request Lifecycle.
 *
 * Uso:
 *   @UseGuards(PosContextGuard)        ← a nivel de clase
 *   async miEndpoint(@ContextoPOS() ctx: IPosContext) { ... }
 */
export const ContextoPOS = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IPosContext => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ posContext: IPosContext }>();
    return request.posContext;
  },
);
