import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { PosCarritoService } from '../pos-carrito/pos-carrito.service.js';
import type { ProcesarOmniboxDto } from './dto/procesar-omnibox.dto.js';
import type { OmniboxResponseDto } from './interfaces/omnibox-response.interface.js';

interface ComandoRapido {
  accion: string;
  regex: RegExp;
  /** Caracter(es) de prefijo/sufijo a remover antes de mandar la cantidad a GX */
  limpiar?: RegExp;
}

/**
 * OmniboxRouterService — replica el Event Enter del legacy: un único input
 * de texto se clasifica en cascada (QR / comando rápido / cantidad / código
 * vs texto libre) y el resultado le dice a React qué UI abrir, sin que el
 * frontend tenga que conocer las reglas de negocio de GeneXus.
 *
 * Reutiliza PosCarritoService.agregarProductoPorOmnibox (que ya implementa
 * resolución de código + evaluación de lote + fail-fast 428) en vez de
 * reimplementar ese flujo acá.
 */
@Injectable()
export class OmniboxRouterService {
  private readonly logger = new Logger(OmniboxRouterService.name);

  private static readonly COMANDOS_RAPIDOS: ComandoRapido[] = [
    { accion: 'ModificaCantidad', regex: /^\s*(\+|-)[0-9]{1,8}(\.\d{1,3})?\s*$/ },
    { accion: 'PisaCantidadMonto', regex: /^\s*#[0-9]{1,8}(\.\d{1,4})?\s*$/, limpiar: /#/g },
    { accion: 'DescuentoPorcentual', regex: /^\s*[%/]\d{1,2}(\.\d{1,3})?\s*$/, limpiar: /[%/]/g },
    { accion: 'PisaPrecio', regex: /^\s*[$*]\d{1,11}(\.\d{1,3})?\s*$/, limpiar: /[$*]/g },
    {
      accion: 'PisaDimensiones',
      regex: /^\s*[0-9]{1,9}(\.\d{1,2})?\*[0-9]{1,9}(\.\d{1,2})?(\*[0-9]{1,9}(\.\d{1,2})?)?\s*$/,
    },
  ];

  private static readonly CANTIDAD_SIMPLE = /^\s*[0-9]{1,8}(\.\d{1,4})?\s*$/;

  constructor(private readonly carritoService: PosCarritoService) {}

  async procesar(
    ctx: IPosContext,
    dto: ProcesarOmniboxDto,
  ): Promise<OmniboxResponseDto> {
    const { input, largoMinimoCodigo } = dto;
    this.logger.log(
      `[OmniboxRouter] input:"${input}" NotaVenta:${dto.notaVentaKey} Emp:${ctx.EmpKey}`,
    );

    // Fase 1: Detección de QR — payload largo sin espacios, típico de un
    // código QR/EAN128 escaneado de un solo golpe.
    if (input.length > 31 && !input.includes(' ')) {
      return { action: 'OPEN_QR_MODAL', payload: { qrData: input } };
    }

    // Fase 2: Comandos rápidos (+/-, #, %, $, dimensiones) — operan sobre la
    // "línea activa" del carrito (ProductoKey=0, ver PosCarritoService).
    for (const comando of OmniboxRouterService.COMANDOS_RAPIDOS) {
      if (comando.regex.test(input)) {
        const cantidad = comando.limpiar
          ? input.trim().replace(comando.limpiar, '')
          : input.trim();
        return this.mutarLineaActiva(ctx, dto, comando.accion, cantidad);
      }
    }

    // Fase 3: número corto y por debajo del largo mínimo de código → el
    // legacy lo asume cantidad, no código de producto.
    if (
      OmniboxRouterService.CANTIDAD_SIMPLE.test(input) &&
      input.length < largoMinimoCodigo
    ) {
      return this.mutarLineaActiva(ctx, dto, 'PisaCantidadMonto', input.trim());
    }

    // Fase 4: Resolución optimista — intenta como código exacto; si GeneXus
    // no lo resuelve (404) se asume texto de búsqueda libre.
    return this.resolverOptimista(ctx, dto);
  }

  private async mutarLineaActiva(
    ctx: IPosContext,
    dto: ProcesarOmniboxDto,
    accion: string,
    cantidad: string,
  ): Promise<OmniboxResponseDto> {
    try {
      const delta = await this.carritoService.agregarProductoCarrito(ctx, {
        notaVentaKey: dto.notaVentaKey,
        categoriaIdl: dto.categoriaIdl,
        accion,
        productoKey: 0,
        cantidad,
      });
      return { action: 'CART_MUTATED', payload: delta };
    } catch (error) {
      return this.mapErrorAAccion(error);
    }
  }

  private async resolverOptimista(
    ctx: IPosContext,
    dto: ProcesarOmniboxDto,
  ): Promise<OmniboxResponseDto> {
    try {
      const delta = await this.carritoService.agregarProductoPorOmnibox(ctx, {
        notaVentaKey: dto.notaVentaKey,
        codigoEscaneado: dto.input,
      });
      return { action: 'CART_MUTATED', payload: delta };
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus();

        if (status === HttpStatus.NOT_FOUND) {
          return { action: 'OPEN_SEARCH_GRID', payload: { keyword: dto.input } };
        }

        if (status === (HttpStatus.PRECONDITION_REQUIRED as number)) {
          const body = error.getResponse() as {
            productoKey: number;
            lotes: unknown;
          };
          return {
            action: 'REQUIRE_LOTE',
            payload: { productoKey: body.productoKey, lotes: body.lotes },
          };
        }
      }
      return this.mapErrorAAccion(error);
    }
  }

  /** Errores de negocio (409/422/401/etc.) se exponen como ERROR — React no
   *  necesita ramificar sobre status HTTP, solo sobre `action`. */
  private mapErrorAAccion(error: unknown): OmniboxResponseDto {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string }).message ?? error.message);
      return { action: 'ERROR', message };
    }
    throw error;
  }
}
