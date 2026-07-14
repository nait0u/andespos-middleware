import {
  Injectable,
  Logger,
  Inject,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import { DeviceService } from '../device/device.service.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import type { GxMessage } from '../../common/interfaces/parameter.interfaces.js';
import type { FiltrosVentasDto } from './dto/filtros-ventas.dto.js';
import type { CrearVentaDto } from './dto/crear-venta.dto.js';
import type { AnularVentaDto } from './dto/anular-venta.dto.js';
import type {
  GxEstadoCajaResponse,
  GxListaVentasXVentaResponse,
  GxCrearNuevaVentaResponse,
  GxAnularVentaXVentaResponse,
  GxPantallaVentaInitResponse,
  GxVentaTotalesResponse,
  GxVentaCarritoResponse,
  GxCartaTouchResponse,
  GxProductoDetallesResponse,
  GxSelectorGeneralResponse,
  GxCategoriasMenuResponse,
  GxCategoriasMenuCacheEntry,
  GxCategoriasMenuPaginadoResponse,
  GxFiltroCategoriasResponse,
} from './interfaces/ventas.interfaces.js';
import type {
  PantallaVentaInitDto,
  PantallaVentaDto,
} from './dto/pantalla-venta.dto.js';
import type {
  GetCartaTouchDto,
  GetProductoDetallesDto,
  GetSelectorGeneralDto,
  FiltroCategoriasDto,
} from './dto/catalogo-venta.dto.js';

@Injectable()
export class VentasService {
  private readonly logger = new Logger(VentasService.name);

  private static readonly GX_XINIT_VENTA = {
    ESTADO_CAJA: 'POS/AI_API/Venta/xInitVenta/GetEstadoCaja',
    LISTA_VENTAS: 'POS/AI_API/Venta/xInitVenta/GetListaVentas',
    CREAR_NUEVA: 'POS/AI_API/Venta/xInitVenta/CrearNuevaVenta',
    ANULAR: 'POS/AI_API/Venta/xInitVenta/AnularVenta',
  } as const;

  private static readonly GX_XVENTA = {
    PANTALLA_INIT: 'POS/AI_API/Venta/xVenta/GetPantallaVentaInit',
    PANTALLA_TOTALES: 'POS/AI_API/Venta/xVenta/GetPantallaVentaTotales',
    PANTALLA_CARRITO: 'POS/AI_API/Venta/xVenta/GetPantallaVentaCarrito',
    CARTA_TOUCH: 'POS/AI_API/Venta/xVenta/GetCartaTouchInicial',
    PRODUCTO_DETALLES: 'POS/AI_API/Venta/xVenta/GetProductoDetallesVenta',
    SELECTOR_GENERAL: 'POS/AI_API/Venta/xVenta/GetSelectorProductoGeneral',
    CATEGORIAS_MENU: 'POS/AI_API/Venta/xVenta/GetCategoriasMenu',
    FILTRO_CATEGORIAS: 'POS/AI_API/Venta/xVenta/GetSelectorFiltroCategorias',
  } as const;

  constructor(
    private readonly genexusClient: GenexusClientService,
    private readonly deviceService: DeviceService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // Token firmado con strControl = EmpKey — convención xVenta para todos los endpoints.
  private tokenParaEmpresa(ctx: IPosContext): string {
    const strControl = String(ctx.EmpKey).trim();
    const token = this.deviceService.tokenGen(strControl);
    if (!token)
      throw new Error(`No se pudo generar token para strControl=${strControl}`);
    return token;
  }

  // ================================================================
  //  GetEstadoCaja
  // ================================================================

  async obtenerEstadoCaja(ctx: IPosContext): Promise<GxEstadoCajaResponse> {
    this.logger.log(
      `[SessionHandler] GetEstadoCaja → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId} Punto:${ctx.PuntoAccesoKey}`,
    );

    const response = await this.genexusClient.request<GxEstadoCajaResponse>(
      VentasService.GX_XINIT_VENTA.ESTADO_CAJA,
      {
        Empkey: ctx.EmpKey,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'GetEstadoCaja');
    this.logger.log(
      `[SessionHandler] GetEstadoCaja OK — Dispositivo:${ctx.DispositivoId}`,
    );
    return response;
  }

  // ================================================================
  //  GetListaVentas — delta-sync de ventas
  // ================================================================

  async obtenerListaVentas(
    ctx: IPosContext,
    filtros: FiltrosVentasDto,
  ): Promise<GxListaVentasXVentaResponse> {
    this.logger.log(
      `[SessionHandler] GetListaVentas → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId} Turno:${ctx.TurnoCajaKey} lastSync:${filtros.lastSync ?? '(sin sync)'}`,
    );

    const response =
      await this.genexusClient.request<GxListaVentasXVentaResponse>(
        VentasService.GX_XINIT_VENTA.LISTA_VENTAS,
        {
          EmpKey: ctx.EmpKey,
          SDTFiltros: {
            SyncTimeStamp: filtros.lastSync,
            FechaFiltro: filtros.fechaFiltro,
            Nota: filtros.nota,
            ClienteNombreCompleto: filtros.clienteNombreCompleto,
          },
          Modo: ctx.Modo,
          Token: this.tokenParaEmpresa(ctx),
        },
        'POST',
        { target: 'pos', contexto: ctx },
      );

    this.throwIfErrors(response.Messages, 'GetListaVentas');
    this.logger.log(
      `[SessionHandler] GetListaVentas OK — Dispositivo:${ctx.DispositivoId}`,
    );
    return response;
  }

  // ================================================================
  //  CrearNuevaVenta
  // ================================================================

  async crearNuevaVenta(
    contexto: IPosContext,
    dto: CrearVentaDto,
  ): Promise<number> {
    this.logger.log(
      `[SessionHandler] CrearNuevaVenta → Emp:${contexto.EmpKey} Dispositivo:${contexto.DispositivoId} Turno:${contexto.TurnoCajaKey}`,
    );

    const response =
      await this.genexusClient.request<GxCrearNuevaVentaResponse>(
        VentasService.GX_XINIT_VENTA.CREAR_NUEVA,
        {
          EmpKey: contexto.EmpKey,
          ClienteKey: dto.clienteKey ?? 0,
          Modo: contexto.Modo,
          Token: this.tokenParaEmpresa(contexto),
        },
        'POST',
        { target: 'pos', contexto: contexto },
      );

    const error = response.Messages?.find((m) => m.Type === 1);
    if (error) {
      this.logger.error(
        `[SessionHandler] Error GeneXus [CrearNuevaVenta] — ${error.Id}: ${error.Description}`,
      );
      throw new InternalServerErrorException({
        message: error.Description,
        code: error.Id,
        context: 'CrearNuevaVenta',
      });
    }

    this.logger.log(
      `[SessionHandler] CrearNuevaVenta OK — NotaVentaKey:${response.NotaVentaKey} Dispositivo:${contexto.DispositivoId}`,
    );
    return response.NotaVentaKey;
  }

  // ================================================================
  //  AnularVenta
  // ================================================================

  async anularVenta(
    contexto: IPosContext,
    dto: AnularVentaDto,
  ): Promise<GxAnularVentaXVentaResponse> {
    this.logger.log(
      `[SessionHandler] AnularVenta → Key:${dto.notaVentaKey} Emp:${contexto.EmpKey} Dispositivo:${contexto.DispositivoId}`,
    );

    const response =
      await this.genexusClient.request<GxAnularVentaXVentaResponse>(
        VentasService.GX_XINIT_VENTA.ANULAR,
        {
          EmpKey: contexto.EmpKey,
          NotaVentaKey: dto.notaVentaKey,
          Token: this.tokenParaEmpresa(contexto),
        },
        'POST',
        { target: 'pos', contexto: contexto },
      );

    this.throwIfErrors(response.Messages, 'AnularVenta');
    this.logger.log(
      `[SessionHandler] AnularVenta OK — Key:${dto.notaVentaKey} Dispositivo:${contexto.DispositivoId}`,
    );
    return response;
  }

  // ================================================================
  //  GetPantallaVentaInit
  // ================================================================

  async obtenerPantallaVentaInit(
    ctx: IPosContext,
    dto: PantallaVentaInitDto,
  ): Promise<GxPantallaVentaInitResponse> {
    this.logger.log(
      `[SessionHandler] GetPantallaVentaInit → Emp:${ctx.EmpKey} Punto:${ctx.PuntoAccesoKey} NotaVenta:${dto.notaVentaKey ?? 0} Dispositivo:${ctx.DispositivoId}`,
    );

    const response =
      await this.genexusClient.request<GxPantallaVentaInitResponse>(
        VentasService.GX_XVENTA.PANTALLA_INIT,
        {
          Empkey: ctx.EmpKey,
          Puntoaccesokey: ctx.PuntoAccesoKey,
          Notaventakey: dto.notaVentaKey ?? 0,
          Pmodo: dto.pmodo ?? ctx.Modo,
          Token: this.tokenParaEmpresa(ctx),
        },
        'GET',
        { target: 'pos', contexto: ctx },
      );

    this.throwIfErrors(response.Messages, 'GetPantallaVentaInit');
    this.logger.log(
      `[SessionHandler] GetPantallaVentaInit OK — Dispositivo:${ctx.DispositivoId}`,
    );
    return response;
  }

  // ================================================================
  //  GetPantallaVentaTotales
  // ================================================================

  async obtenerVentaTotales(
    ctx: IPosContext,
    dto: PantallaVentaDto,
  ): Promise<GxVentaTotalesResponse> {
    this.logger.log(
      `[SessionHandler] GetPantallaVentaTotales → Emp:${ctx.EmpKey} Punto:${ctx.PuntoAccesoKey} NotaVenta:${dto.notaVentaKey ?? 0} Dispositivo:${ctx.DispositivoId}`,
    );

    const response = await this.genexusClient.request<GxVentaTotalesResponse>(
      VentasService.GX_XVENTA.PANTALLA_TOTALES,
      {
        Empkey: ctx.EmpKey,
        Puntoaccesokey: ctx.PuntoAccesoKey,
        Notaventakey: dto.notaVentaKey ?? 0,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'GetPantallaVentaTotales');
    this.logger.log(
      `[SessionHandler] GetPantallaVentaTotales OK — Dispositivo:${ctx.DispositivoId}`,
    );
    return response;
  }

  // ================================================================
  //  GetPantallaVentaCarrito
  // ================================================================

  async obtenerVentaCarrito(
    ctx: IPosContext,
    dto: PantallaVentaDto,
  ): Promise<GxVentaCarritoResponse> {
    this.logger.log(
      `[SessionHandler] GetPantallaVentaCarrito → Emp:${ctx.EmpKey} Punto:${ctx.PuntoAccesoKey} NotaVenta:${dto.notaVentaKey ?? 0} Dispositivo:${ctx.DispositivoId}`,
    );

    const response = await this.genexusClient.request<GxVentaCarritoResponse>(
      VentasService.GX_XVENTA.PANTALLA_CARRITO,
      {
        Empkey: ctx.EmpKey,
        Puntoaccesokey: ctx.PuntoAccesoKey,
        Notaventakey: dto.notaVentaKey ?? 0,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'GetPantallaVentaCarrito');
    this.logger.log(
      `[SessionHandler] GetPantallaVentaCarrito OK — Dispositivo:${ctx.DispositivoId}`,
    );
    return response;
  }

  // ================================================================
  //  GetCartaTouchInicial
  // ================================================================

  async obtenerCartaTouch(
    ctx: IPosContext,
    dto: GetCartaTouchDto,
  ): Promise<GxCartaTouchResponse> {
    this.logger.log(
      `[SessionHandler] GetCartaTouchInicial → Emp:${ctx.EmpKey} Punto:${ctx.PuntoAccesoKey} Dispositivo:${ctx.DispositivoId}`,
    );

    const response = await this.genexusClient.request<GxCartaTouchResponse>(
      VentasService.GX_XVENTA.CARTA_TOUCH,
      {
        Empkey: ctx.EmpKey,
        Puntoaccesokey: ctx.PuntoAccesoKey,
        Categoriaidl: dto.categoriaIdl,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'GetCartaTouchInicial');
    this.logger.log(
      `[SessionHandler] GetCartaTouchInicial OK — Dispositivo:${ctx.DispositivoId}`,
    );
    return response;
  }

  // ================================================================
  //  GetProductoDetallesVenta
  // ================================================================

  async obtenerProductoDetalles(
    ctx: IPosContext,
    dto: GetProductoDetallesDto,
  ): Promise<GxProductoDetallesResponse> {
    this.logger.log(
      `[SessionHandler] GetProductoDetallesVenta → MItemKey:${dto.mitemKey} Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`,
    );

    const response =
      await this.genexusClient.request<GxProductoDetallesResponse>(
        VentasService.GX_XVENTA.PRODUCTO_DETALLES,
        {
          Empkey: ctx.EmpKey,
          Puntoaccesokey: ctx.PuntoAccesoKey,
          Mitemkey: dto.mitemKey,
          Token: this.tokenParaEmpresa(ctx),
        },
        'GET',
        { target: 'pos', contexto: ctx },
      );

    this.throwIfErrors(response.Messages, 'GetProductoDetallesVenta');
    this.logger.log(
      `[SessionHandler] GetProductoDetallesVenta OK — Dispositivo:${ctx.DispositivoId}`,
    );
    return response;
  }

  // ================================================================
  //  GetSelectorProductoGeneral
  // ================================================================

  async obtenerSelectorGeneral(
    ctx: IPosContext,
    dto: GetSelectorGeneralDto,
  ): Promise<GxSelectorGeneralResponse> {
    this.logger.log(
      `[SessionHandler] GetSelectorProductoGeneral → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`,
    );

    const response =
      await this.genexusClient.request<GxSelectorGeneralResponse>(
        VentasService.GX_XVENTA.SELECTOR_GENERAL,
        {
          Empkey: ctx.EmpKey,
          Puntoaccesokey: ctx.PuntoAccesoKey,
          Textobusqueda: dto.textoBusqueda,
          Codigobusqueda: dto.codigoBusqueda,
          Token: this.tokenParaEmpresa(ctx),
        },
        'GET',
        { target: 'pos', contexto: ctx },
      );

    this.throwIfErrors(response.Messages, 'GetSelectorProductoGeneral');
    this.logger.log(
      `[SessionHandler] GetSelectorProductoGeneral OK — Dispositivo:${ctx.DispositivoId}`,
    );
    return response;
  }

  // ================================================================
  //  GetCategoriasMenu — con caché y paginación local en el BFF
  // ================================================================

  async obtenerCategoriasMenuPaginado(
    ctx: IPosContext,
    limit: number,
    offset: number,
  ): Promise<GxCategoriasMenuPaginadoResponse> {
    const cacheKey = `categorias_menu_emp_${ctx.EmpKey}`;

    let entry =
      await this.cacheManager.get<GxCategoriasMenuCacheEntry>(cacheKey);

    if (!entry) {
      this.logger.log(
        `[SessionHandler] GetCategoriasMenu cache MISS → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`,
      );

      const response =
        await this.genexusClient.request<GxCategoriasMenuResponse>(
          VentasService.GX_XVENTA.CATEGORIAS_MENU,
          {
            Empkey: ctx.EmpKey,
            Token: this.tokenParaEmpresa(ctx),
          },
          'GET',
          { target: 'pos', contexto: ctx },
        );

      this.logger.debug(
        `[GetCategoriasMenu] Respuesta raw: ${JSON.stringify(response)}`,
      );
      this.throwIfErrors(response.Messages, 'GetCategoriasMenu');

      response.ColClasificadoras ??= [];
      response.ColBuscadoras ??= [];

      entry = { data: response, fetchedAt: new Date().toISOString() };
      await this.cacheManager.set(cacheKey, entry);

      this.logger.log(
        `[SessionHandler] GetCategoriasMenu cacheado — Emp:${ctx.EmpKey} Clasificadoras:${response.ColClasificadoras.length} Buscadoras:${response.ColBuscadoras.length}`,
      );
    } else {
      this.logger.log(
        `[SessionHandler] GetCategoriasMenu cache HIT → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`,
      );
    }

    const { data } = entry;
    const clasificadoras = data.ColClasificadoras ?? [];
    const buscadoras = data.ColBuscadoras ?? [];
    return {
      ColClasificadoras: clasificadoras.slice(offset, offset + limit),
      ColBuscadoras: buscadoras.slice(offset, offset + limit),
      TotalClasificadoras: clasificadoras.length,
      TotalBuscadoras: buscadoras.length,
      SyncTimeStamp: entry.fetchedAt,
      Messages: data.Messages,
    };
  }

  // ================================================================
  //  GetSelectorFiltroCategorias
  // ================================================================

  async filtrarCategorias(
    ctx: IPosContext,
    dto: FiltroCategoriasDto,
  ): Promise<GxFiltroCategoriasResponse> {
    this.logger.log(
      `[SessionHandler] GetSelectorFiltroCategorias → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`,
    );

    const gxPayload = {
      EmpKey: ctx.EmpKey,
      PuntoAccesoKey: ctx.PuntoAccesoKey,
      ColCatClasificadoras: (dto.colCatClasificadoras ?? []).map((c) => ({
        CatCod: c,
      })),
      ColCatBuscadoras: (dto.colCatBuscadoras ?? []).map((c) => ({
        CatCod: c,
      })),
      TextoBusqueda: dto.textoBusqueda,
      Token: this.tokenParaEmpresa(ctx),
    };
    this.logger.debug(
      `[GetSelectorFiltroCategorias] Payload → GeneXus: ${JSON.stringify(gxPayload)}`,
    );

    const response =
      await this.genexusClient.request<GxFiltroCategoriasResponse>(
        VentasService.GX_XVENTA.FILTRO_CATEGORIAS,
        gxPayload,
        'POST',
        { target: 'pos', contexto: ctx },
      );

    this.throwIfErrors(response.Messages, 'GetSelectorFiltroCategorias');
    this.logger.log(
      `[SessionHandler] GetSelectorFiltroCategorias OK — Dispositivo:${ctx.DispositivoId}`,
    );
    return response;
  }

  // ================================================================

  private throwIfErrors(messages: GxMessage[], context: string): void {
    if (!messages || messages.length === 0) return;

    const error = messages.find((m) => m.Type === 1);
    if (error) {
      this.logger.error(
        `[SessionHandler] Error GeneXus [${context}] — ${error.Id}: ${error.Description}`,
      );
      throw new HttpException(
        { message: error.Description, code: error.Id, context },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }
}
