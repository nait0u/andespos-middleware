import {
  Controller,
  Put,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ContextoPOS } from '../../common/decorators/pos-context.decorator.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { PosCarritoService } from './pos-carrito.service.js';
import { AgregarProductoCarritoDto } from './dto/agregar-producto-carrito.dto.js';
import { EstablecerCantidadProductoDto } from './dto/establecer-cantidad-producto.dto.js';
import { AgregarPorOmniboxDto } from './dto/agregar-por-omnibox.dto.js';
import { EliminarLineaCarritoDto } from './dto/eliminar-linea-carrito.dto.js';
import { EditarGlosaCabeceraDto } from './dto/editar-glosa-cabecera.dto.js';
import { EditarGlosaLineaDto } from './dto/editar-glosa-linea.dto.js';
import { AplicarDescuentoGlobalDto } from './dto/aplicar-descuento-global.dto.js';
import { AsignarClienteDto } from './dto/asignar-cliente.dto.js';
import { AsignarVendedorDto } from './dto/asignar-vendedor.dto.js';
import { GuardarTransportistaDto } from './dto/guardar-transportista.dto.js';
import { SincronizarReferenciasDto } from './dto/sincronizar-referencias.dto.js';

/**
 * PosCarritoController — operaciones transaccionales sobre el carrito de
 * la NotaVenta activa (xVenta). Todo mutador que altera líneas/totales
 * retorna el Delta (SDTVentaCarrito) + Totales recalculados; el frontend
 * consolida ese Delta en su estado local en vez de refetchear el carrito.
 */
@UseGuards(PosContextGuard)
@Controller('api/pos/carrito')
export class PosCarritoController {
  constructor(private readonly carritoService: PosCarritoService) {}

  /** POST /api/pos/carrito/producto — agrega un producto de catálogo (ProductoKey) */
  @Post('producto')
  async agregarProductoCarrito(
    @Body() dto: AgregarProductoCarritoDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.carritoService.agregarProductoCarrito(ctx, dto);
  }

  /**
   * PUT /api/pos/carrito/producto/cantidad
   * Fija la cantidad ABSOLUTA de una línea (reemplaza, no suma) —
   * ver PosCarritoService.establecerCantidadProducto.
   */
  @Put('producto/cantidad')
  async establecerCantidadProducto(
    @Body() dto: EstablecerCantidadProductoDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.carritoService.establecerCantidadProducto(ctx, dto);
  }

  /**
   * POST /api/pos/carrito/omnibox
   * Flujo completo del OmniBox: resuelve CodigoEscaneado → ProductoKey,
   * evalúa/resuelve lote y agrega al carrito en una sola llamada. Si el
   * producto exige lote y no puede resolverse solo, responde 428 con la
   * lista de lotes para que el frontend despliegue el selector.
   */
  @Post('omnibox')
  async agregarProductoPorOmnibox(
    @Body() dto: AgregarPorOmniboxDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.carritoService.agregarProductoPorOmnibox(ctx, dto);
  }

  /** DELETE /api/pos/carrito/linea?notaVentaKey=&notaVentaProductoLinea= */
  @Delete('linea')
  async eliminarLineaCarrito(
    @Query() dto: EliminarLineaCarritoDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.carritoService.eliminarLineaCarrito(ctx, dto);
  }

  /**
   * PUT /api/pos/carrito/glosa-cabecera
   * No retorna Delta — solo confirma la escritura de la glosa de cabecera.
   */
  @Put('glosa-cabecera')
  async editarGlosaCabecera(
    @Body() dto: EditarGlosaCabeceraDto,
    @ContextoPOS() ctx: IPosContext,
  ): Promise<{ ok: true }> {
    await this.carritoService.editarGlosaCabecera(ctx, dto);
    return { ok: true };
  }

  /** PUT /api/pos/carrito/glosa-linea */
  @Put('glosa-linea')
  async editarGlosaLinea(
    @Body() dto: EditarGlosaLineaDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.carritoService.editarGlosaLinea(ctx, dto);
  }

  /** PUT /api/pos/carrito/descuento-global */
  @Put('descuento-global')
  async aplicarDescuentoGlobal(
    @Body() dto: AplicarDescuentoGlobalDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.carritoService.aplicarDescuentoGlobal(ctx, dto);
  }

  /** PUT /api/pos/carrito/cliente — ClienteKey=0 desasigna */
  @Put('cliente')
  async asignarCliente(
    @Body() dto: AsignarClienteDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.carritoService.asignarCliente(ctx, dto);
  }

  /** PUT /api/pos/carrito/vendedor */
  @Put('vendedor')
  async asignarVendedor(
    @Body() dto: AsignarVendedorDto,
    @ContextoPOS() ctx: IPosContext,
  ): Promise<{ ok: true }> {
    await this.carritoService.asignarVendedor(ctx, dto);
    return { ok: true };
  }

  /** PUT /api/pos/carrito/transportista */
  @Put('transportista')
  async guardarTransportista(
    @Body() dto: GuardarTransportistaDto,
    @ContextoPOS() ctx: IPosContext,
  ): Promise<{ ok: true }> {
    await this.carritoService.guardarTransportista(ctx, dto);
    return { ok: true };
  }

  /**
   * PUT /api/pos/carrito/referencias
   * Operación bulk: reemplaza el estado completo de referencias.
   * Enviar `referencias: []` elimina todas las referencias existentes.
   */
  @Put('referencias')
  async sincronizarReferencias(
    @Body() dto: SincronizarReferenciasDto,
    @ContextoPOS() ctx: IPosContext,
  ): Promise<{ ok: true }> {
    await this.carritoService.sincronizarReferencias(ctx, dto);
    return { ok: true };
  }
}
