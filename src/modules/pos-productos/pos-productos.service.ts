import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import { DeviceService } from '../device/device.service.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { throwGxHttpError } from '../../common/helpers/gx-error-mapper.helper.js';
import type {
  GxBuscarProductoOmniboxResponse,
  ProductoResolucionDto,
  GxGetLotesPorProductoResponse,
  LoteProductoDto,
} from './interfaces/pos-productos.interfaces.js';

/**
 * PosProductosService — resolución de OmniBox (código escaneado → ProductoKey)
 * y consulta de lotes. Servicios de solo-lectura, sin efectos sobre el
 * carrito; PosCarritoService los orquesta para el flujo transaccional
 * completo (ver PosCarritoService.agregarProductoPorOmnibox).
 */
@Injectable()
export class PosProductosService {
  private readonly logger = new Logger(PosProductosService.name);

  private static readonly GX = {
    BUSCAR_OMNIBOX: 'POS/AI_API/Venta/xVenta/BuscarProductoOmnibox',
    GET_LOTES: 'POS/AI_API/Venta/xVenta/GetLotesPorProducto',
  } as const;

  constructor(
    private readonly genexusClient: GenexusClientService,
    private readonly deviceService: DeviceService,
  ) {}

  private tokenParaEmpresa(ctx: IPosContext): string {
    const strControl = String(ctx.EmpKey).trim();
    const token = this.deviceService.tokenGen(strControl);
    if (!token)
      throw new Error(`No se pudo generar token para strControl=${strControl}`);
    return token;
  }

  // ================================================================
  //  BuscarProductoOmnibox — resolución Código escaneado → ProductoKey
  // ================================================================

  async resolverOmnibox(
    ctx: IPosContext,
    codigoEscaneado: string,
  ): Promise<ProductoResolucionDto> {
    this.logger.log(
      `[SessionHandler] BuscarProductoOmnibox → Codigo:${codigoEscaneado} Emp:${ctx.EmpKey}`,
    );

    const response =
      await this.genexusClient.request<GxBuscarProductoOmniboxResponse>(
        PosProductosService.GX.BUSCAR_OMNIBOX,
        {
          Empkey: ctx.EmpKey,
          Puntoaccesokey: ctx.PuntoAccesoKey,
          Codigoescaneado: codigoEscaneado,
          Token: this.tokenParaEmpresa(ctx),
        },
        'GET',
        { target: 'pos', contexto: ctx },
      );

    throwGxHttpError(response.Messages, 'BuscarProductoOmnibox');

    // GeneXus no siempre acompaña "no encontrado" de un Message, y ProductoKey
    // puede venir como string ("0") o como -1 según el caso — se normaliza a
    // Number antes de evaluar; cualquier valor <= 0 se trata como no-resuelto.
    const productoKey = Number(response.ProductoKey);
    if (!productoKey || productoKey <= 0) {
      throw new HttpException(
        {
          message: `No se encontró un producto para el código "${codigoEscaneado}"`,
          context: 'BuscarProductoOmnibox',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    this.logger.log(
      `[SessionHandler] BuscarProductoOmnibox OK — ProductoKey:${productoKey}`,
    );
    return {
      productoKey,
      modalidadVenta: Number(response.ModalidaVenta),
      usaLote: response.UsaLote,
      vendeLote: response.VendeLote,
      loteUnicoKey: Number(response.LoteUnicoKey),
    };
  }

  // ================================================================
  //  GetLotesPorProducto
  // ================================================================

  async obtenerLotesPorProducto(
    ctx: IPosContext,
    productoKey: number,
  ): Promise<LoteProductoDto[]> {
    this.logger.log(
      `[SessionHandler] GetLotesPorProducto → Producto:${productoKey} Emp:${ctx.EmpKey}`,
    );

    const response =
      await this.genexusClient.request<GxGetLotesPorProductoResponse>(
        PosProductosService.GX.GET_LOTES,
        {
          Empkey: ctx.EmpKey,
          Puntoaccesokey: ctx.PuntoAccesoKey,
          Productokey: productoKey,
          Token: this.tokenParaEmpresa(ctx),
        },
        'GET',
        { target: 'pos', contexto: ctx },
      );

    throwGxHttpError(response.Messages, 'GetLotesPorProducto');

    const lotes = response.SDTLoteList ?? [];
    if (lotes.length === 0) {
      throw new HttpException(
        {
          message: `No hay lotes vigentes para el producto ${productoKey}`,
          context: 'GetLotesPorProducto',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    this.logger.log(
      `[SessionHandler] GetLotesPorProducto OK — count:${lotes.length}`,
    );
    return lotes.map((l) => ({
      loteKey: Number(l.LoteKey),
      loteCodigo: l.LoteCodigo,
      loteCaducaFecha: l.LoteCaducaFecha,
      cantidadInventario: Number(l.CantidadInventario),
    }));
  }
}
