import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import { TokenService } from '@andestec/api-dispositivos';
import { ParameterService } from '../parameter/parameter.service.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import type { GxMessage } from '../../common/interfaces/parameter.interfaces.js';
import type { FiltrosPreciosDto } from './dto/filtros-precios.dto.js';
import type { NovedadesPreciosDto } from './dto/novedades-precios.dto.js';
import type { CaducarPrecioDto } from './dto/caducar-precio.dto.js';
import type { CrearPrecioDto } from './dto/crear-precio.dto.js';
import type { GuardarPrecioDto } from './dto/guardar-precio.dto.js';
import type { UploadPreciosDto } from './dto/upload-precios.dto.js';
import type {
  GxGetPreciosResponse,
  GxGetNovedadesResponse,
  GxCaducarPrecioResponse,
  GxCrearPrecioResponse,
  GxGuardarPrecioResponse,
  GxUploadPreciosResponse,
  GxGetProductosBuscadorResponse,
  GxGetUbicacionesResponse,
  GxGetFormatosUploadResponse,
  GxGetCategoriasPrecioResponse,
} from './interfaces/precios.interfaces.js';

@Injectable()
export class PreciosService {
  private readonly logger = new Logger(PreciosService.name);

  // Rutas de la app AndesPOS_API2602N — NO modificar sin coordinación con equipo GeneXus
  private static readonly GX = {
    API_BASE:        'POS/AI_API/Precios/xListaDePrecios',
    LISTA:           'POS/AI_API/Precios/xListaDePrecios/GetPrecios',
    CADUCAR:         'POS/AI_API/Precios/xListaDePrecios/CaducarPrecio',
    CREAR:           'POS/AI_API/Precios/xListaDePrecios/CrearPrecioNuevo',
    GUARDAR:         'POS/AI_API/Precios/xListaDePrecios/GuardarPrecioAPI',
    UPLOAD:          'POS/AI_API/Precios/xListaDePrecios/UploadPreciosNativo',
    BUSCAR:          'POS/AI_API/Precios/xListaDePrecios/GetProductosBuscador',
    UBICACIONES:     'POS/AI_API/Precios/xListaDePrecios/GetUbicaciones',
    FORMATOS_UPLOAD: 'POS/AI_API/Precios/xListaDePrecios/GetFormatosUpload',
    CATEGORIAS:      'POS/AI_API/Precios/xListaDePrecios/GetCategoriasPrecio',
  } as const;

  constructor(
    private readonly genexusClient: GenexusClientService,
    private readonly tokenService: TokenService,
    private readonly parameterService: ParameterService,
  ) {}

  // Token firmado con strControl = EmpKey — convención para reads y operaciones
  // a nivel empresa (GetPrecios, GetNovedades, GetUbicaciones, GetCategoriasPrecio,
  // GetProductosBuscador, GetFormatosUpload, UploadPreciosNativo).
  private tokenParaEmpresa(ctx: IPosContext): string {
    const strControl = String(ctx.EmpKey).trim();
    const token = this.tokenService.TokenGen(strControl);
    if (!token) throw new Error(`No se pudo generar token para strControl=${strControl}`);
    return token;
  }

  // Token firmado con strControl compuesto (EmpKey + ProductoKey), requerido por
  // GuardarPrecioAPI, CaducarPrecio y CrearPrecioNuevo en GeneXus.
  private tokenParaProducto(ctx: IPosContext, productoKey: number): string {
    const strControl = String(ctx.EmpKey).trim() + String(productoKey).trim();
    const token = this.tokenService.TokenGen(strControl);
    if (!token) throw new Error(`No se pudo generar token para strControl=${strControl}`);
    return token;
  }

  // ── GetPrecios ────────────────────────────────────────────────────────────

  async getPrecios(
    ctx: IPosContext,
    filtros: FiltrosPreciosDto,
  ): Promise<GxGetPreciosResponse> {
    this.logger.log(`[SessionHandler] GetPrecios → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`);

    // GetPreciosInput según xListaDePrecios.yaml: { EmpKey, FiltroPreciosSDT, Token }.
    // EmpKey va en el top-level; FiltroPrecios NO lo lleva.
    const filtroPreciosSDT: Record<string, unknown> = {};
    if (filtros.codIntValor !== undefined)         filtroPreciosSDT.CodIntValor = filtros.codIntValor;
    if (filtros.productoDescripcion !== undefined) filtroPreciosSDT.ProductoDescripcion = filtros.productoDescripcion;
    if (filtros.ubicacion !== undefined)           filtroPreciosSDT.Ubicacion = filtros.ubicacion;
    if (filtros.categoriaPrecioIdl !== undefined)  filtroPreciosSDT.CategoriaPrecioIdl = filtros.categoriaPrecioIdl;
    if (filtros.precioCantidad !== undefined)      filtroPreciosSDT.PrecioCantidad = filtros.precioCantidad;
    if (filtros.fechaFiltro !== undefined)         filtroPreciosSDT.FechaFiltro = filtros.fechaFiltro;
    if (filtros.lastSync !== undefined)            filtroPreciosSDT.SyncTimeStamp = filtros.lastSync;

    const payload = {
      EmpKey: ctx.EmpKey,
      FiltroPreciosSDT: filtroPreciosSDT,
      Token: this.tokenParaEmpresa(ctx),
    };
    this.logger.debug(
      `[SessionHandler] GetPrecios payload → ${JSON.stringify(payload)}`,
    );

    const response = await this.genexusClient.request<GxGetPreciosResponse>(
      PreciosService.GX.LISTA,
      payload,
      'POST',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'GetPrecios');
    this.logger.log(`[SessionHandler] GetPrecios OK — ${response.Messages?.length ?? 0} mensajes GeneXus`);
    return response;
  }

  // ── GetNovedades ─────────────────────────────────────────────────────────

  async getNovedades(
    ctx: IPosContext,
    filtros: NovedadesPreciosDto,
  ): Promise<GxGetNovedadesResponse> {
    this.logger.log(
      `[SessionHandler] GetNovedades (vía GetPrecios) → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId} UbiCod:${filtros.ubiCod ?? '-'} lastSync:${filtros.lastSync ?? '(sin sync)'}`,
    );

    // El API GeneXus xListaDePrecios no expone /GetNovedades como endpoint
    // separado. El delta-sync se obtiene llamando GetPrecios con SyncTimeStamp
    // en el FiltroPreciosSDT. La respuesta usa `TimeStamp`, que aquí se
    // remapea a `TimeStampOut` para preservar el contrato del frontend.
    const filtroPreciosSDT: Record<string, unknown> = {};
    if (filtros.ubiCod !== undefined)   filtroPreciosSDT.Ubicacion = filtros.ubiCod;
    if (filtros.lastSync !== undefined) filtroPreciosSDT.SyncTimeStamp = filtros.lastSync;

    const response = await this.genexusClient.request<GxGetPreciosResponse>(
      PreciosService.GX.LISTA,
      {
        EmpKey: ctx.EmpKey,
        FiltroPreciosSDT: filtroPreciosSDT,
        Token: this.tokenParaEmpresa(ctx),
      },
      'POST',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'GetNovedades');
    this.logger.log(`[SessionHandler] GetNovedades OK — ${response.ListaPreciosSDT?.length ?? 0} precios, ${response.Messages?.length ?? 0} mensajes GeneXus`);

    return {
      ListaPreciosSDT: response.ListaPreciosSDT,
      TimeStampOut: response.TimeStamp,
      Messages: response.Messages,
    };
  }

  // ── CaducarPrecio ────────────────────────────────────────────────────────

  async caducarPrecio(
    ctx: IPosContext,
    body: CaducarPrecioDto,
  ): Promise<GxCaducarPrecioResponse> {
    this.logger.log(
      `[SessionHandler] CaducarPrecio → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId} Producto:${body.productoKey}`,
    );

    const response = await this.genexusClient.request<GxCaducarPrecioResponse>(
      PreciosService.GX.CADUCAR,
      {
        EmpKey: ctx.EmpKey,
        ProductoKey: body.productoKey,
        PrecioTimeInicio: body.precioTimeInicio,
        PrecioUbiCod: body.precioUbiCod,
        CategoriaPrecioIdl: body.categoriaPrecioIdl,
        PrecioCantidad: body.precioCantidad,
        PrecioHoraInicio: body.precioHoraInicio,
        Token: this.tokenParaProducto(ctx, body.productoKey),
      },
      'POST',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'CaducarPrecio');
    this.logger.log(`[SessionHandler] CaducarPrecio OK — Producto:${body.productoKey}`);
    return response;
  }

  // ── CrearPrecioNuevo ─────────────────────────────────────────────────────

  async crearPrecio(
    ctx: IPosContext,
    body: CrearPrecioDto,
  ): Promise<GxCrearPrecioResponse> {
    this.logger.log(
      `[SessionHandler] CrearPrecioNuevo → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId} Producto:${body.productoKey}`,
    );

    const response = await this.genexusClient.request<GxCrearPrecioResponse>(
      PreciosService.GX.CREAR,
      {
        EmpKey: ctx.EmpKey,
        ProductoKey: body.productoKey,
        UbiCod: body.ubiCod,
        PrecioValor: body.precioValor,
        Token: this.tokenParaProducto(ctx, body.productoKey),
      },
      'POST',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'CrearPrecioNuevo');
    this.logger.log(`[SessionHandler] CrearPrecioNuevo OK — Producto:${body.productoKey}`);
    return response;
  }

  // ── GuardarPrecioAPI ─────────────────────────────────────────────────────

  async guardarPrecio(
    ctx: IPosContext,
    body: GuardarPrecioDto,
  ): Promise<GxGuardarPrecioResponse> {
    this.logger.log(
      `[SessionHandler] GuardarPrecioAPI → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId} Producto:${body.productoKey}`,
    );

    const response = await this.genexusClient.request<GxGuardarPrecioResponse>(
      PreciosService.GX.GUARDAR,
      {
        EmpKey: ctx.EmpKey,
        ProductoKey: body.productoKey,
        PrecioTimeInicio: body.precioTimeInicio,
        UbiCod: body.ubiCod,
        CategoriaPrecioIdl: body.categoriaPrecioIdl,
        PrecioCantidad: body.precioCantidad,
        PrecioHoraInicio: body.precioHoraInicio,
        PrecioHoraFin: body.precioHoraFin,
        PrecioTimeFin: body.precioTimeFin,
        PrecioValor: body.precioValor,
        PrecioDescuentoPorcentaje: body.precioDescuentoPorcentaje,
        PrecioDescuentoMax: body.precioDescuentoMax,
        Token: this.tokenParaProducto(ctx, body.productoKey),
      },
      'POST',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'GuardarPrecioAPI');
    this.logger.log(`[SessionHandler] GuardarPrecioAPI OK — Producto:${body.productoKey}`);
    return response;
  }

  // ── UploadPreciosNativo ──────────────────────────────────────────────────

  async uploadPrecios(
    ctx: IPosContext,
    body: UploadPreciosDto,
  ): Promise<GxUploadPreciosResponse> {
    const { fileName, parmTransConf, fileBlobFile } = body;

    this.logger.log(
      `[SessionHandler] UploadPreciosNativo → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId} File:${fileName} ParmTransConf:${parmTransConf}`,
    );

    if (!fileBlobFile || !fileName || !parmTransConf) {
      throw new BadRequestException(
        'UploadPrecios requiere fileBlobFile, fileName y parmTransConf',
      );
    }

    // Paso 1 — gxobject. GeneXus exige que FileBlobFile sea una referencia de blob
    // previamente subida via /gxobject; mandarle base64 puro devuelve HTTP 412.
    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBlobFile, 'base64');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[UploadPrecios] Base64 inválido en fileBlobFile — File:${fileName}: ${msg}`,
      );
      throw new BadRequestException('fileBlobFile no es un base64 válido');
    }

    let objectId: string;
    try {
      // /gxobject está scoped al API object (xListaDePrecios), no al procedure
      // — ver `paths: /POS/AI_API/Precios/xListaDePrecios/gxobject` en el yaml
      // POS.AI_API.Precios.xListaDePrecios.
      objectId = await this.genexusClient.uploadBlob(
        ctx,
        PreciosService.GX.API_BASE,
        buffer,
        fileName,
      );
    } catch (err) {
      this.logger.error(
        `[UploadPrecios] Falló paso 1/2 (gxobject) — File:${fileName}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    // Paso 2 — endpoint de negocio, pasando object_id como FileBlobFile.
    let response: GxUploadPreciosResponse;
    try {
      response = await this.genexusClient.request<GxUploadPreciosResponse>(
        PreciosService.GX.UPLOAD,
        {
          EmpKey: ctx.EmpKey,
          ParmTransConf: parmTransConf,
          FileBlobFile: objectId,
          FileName: fileName,
          Token: this.tokenParaEmpresa(ctx),
        },
        'POST',
        { target: 'pos', contexto: ctx },
      );
    } catch (err) {
      this.logger.error(
        `[UploadPrecios] Falló paso 2/2 (UploadPreciosNativo) — File:${fileName} objectId:${objectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    this.throwIfErrors(response.Messages, 'UploadPreciosNativo');
    this.logger.log(
      `[SessionHandler] UploadPreciosNativo OK — File:${fileName} objectId:${objectId}`,
    );
    return response;
  }

  // ── GetProductosBuscador ─────────────────────────────────────────────────

  async buscarProductos(
    ctx: IPosContext,
    textoBusqueda: string,
  ): Promise<GxGetProductosBuscadorResponse> {
    this.logger.log(
      `[SessionHandler] GetProductosBuscador → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId} Texto:"${textoBusqueda}"`,
    );

    const response =
      await this.genexusClient.request<GxGetProductosBuscadorResponse>(
        PreciosService.GX.BUSCAR,
        {
          Empkey: ctx.EmpKey,
          Textobusqueda: textoBusqueda,
          Token: this.tokenParaEmpresa(ctx),
        },
        'GET',
        { target: 'pos', contexto: ctx },
      );

    this.throwIfErrors(response.Messages, 'GetProductosBuscador');
    this.logger.log(`[SessionHandler] GetProductosBuscador OK — Dispositivo:${ctx.DispositivoId}`);
    return response;
  }

  // ── GetUbicaciones ───────────────────────────────────────────────────────

  async getUbicaciones(ctx: IPosContext): Promise<GxGetUbicacionesResponse> {
    this.logger.log(`[SessionHandler] GetUbicaciones → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`);

    const response =
      await this.genexusClient.request<GxGetUbicacionesResponse>(
        PreciosService.GX.UBICACIONES,
        { Empkey: ctx.EmpKey, Token: this.tokenParaEmpresa(ctx) },
        'GET',
        { target: 'pos', contexto: ctx },
      );

    this.throwIfErrors(response.Messages, 'GetUbicaciones');
    this.logger.log(`[SessionHandler] GetUbicaciones OK — Dispositivo:${ctx.DispositivoId}`);
    return response;
  }

  // ── GetFormatosUpload ────────────────────────────────────────────────────

  async getFormatosUpload(
    ctx: IPosContext,
    parametroId?: string,
  ): Promise<GxGetFormatosUploadResponse> {
    this.logger.log(`GetFormatosUpload — Emp:${ctx.EmpKey} Param:${parametroId ?? '-'}`);

    // El valor del parámetro es una lista serializada "ID,Desc;ID,Desc" — no un input para GeneXus.
    // Se parsea directamente desde el sistema de parámetros (Aplicacion_Idl="ServidorPOS").
    if (parametroId) {
      const valoresResp = await this.parameterService.obtenerParametrosValues({
        Empkey: ctx.EmpKey,
        Aplicacion_Idl: 'ServidorPOS',
        ParametroId: parametroId,
      });
      const item = valoresResp?.ParametrosValuesApp?.ParametroValueArray?.find(
        (p) => p.ParametroId === parametroId,
      );

      if (item?.ValorParametroValor) {
        // Formato: "ID,Descripcion;ID,Descripcion;..."
        const FormatosList = item.ValorParametroValor
          .split(';')
          .filter(Boolean)
          .map((entry) => {
            const [Id, ...rest] = entry.split(',');
            return { Id: Id.trim(), Descripcion: rest.join(',').trim() };
          });

        this.logger.log(`GetFormatosUpload — ${FormatosList.length} formatos desde parámetros`);
        return { FormatosList, Messages: [] };
      }

      this.logger.warn(`GetFormatosUpload — ParametroId "${parametroId}" no encontrado en ServidorPOS`);
    }

    return { FormatosList: [], Messages: [] };
  }

  // ── GetCategoriasPrecio ──────────────────────────────────────────────────

  async getCategorias(ctx: IPosContext): Promise<GxGetCategoriasPrecioResponse> {
    this.logger.log(`[SessionHandler] GetCategoriasPrecio → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`);

    const response =
      await this.genexusClient.request<GxGetCategoriasPrecioResponse>(
        PreciosService.GX.CATEGORIAS,
        { Empkey: ctx.EmpKey, Token: this.tokenParaEmpresa(ctx) },
        'GET',
        { target: 'pos', contexto: ctx },
      );

    this.throwIfErrors(response.Messages, 'GetCategoriasPrecio');
    this.logger.log(`[SessionHandler] GetCategoriasPrecio OK — Dispositivo:${ctx.DispositivoId}`);
    return response;
  }

  // ── Manejo de errores ────────────────────────────────────────────────────

  private throwIfErrors(messages: GxMessage[] | undefined, context: string): void {
    if (!messages?.length) return;

    const error = messages.find((m) => m.Type === 1);
    if (error) {
      this.logger.error(
        `Error GeneXus [${context}] — ${error.Id}: ${error.Description}`,
      );
      throw new HttpException(
        { message: error.Description, code: error.Id, context },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }
}
