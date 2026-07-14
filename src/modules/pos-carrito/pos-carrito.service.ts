import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import { DeviceService } from '../device/device.service.js';
import { PosProductosService } from '../pos-productos/pos-productos.service.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import {
  throwGxHttpError,
  assertContextoCompleto,
} from '../../common/helpers/gx-error-mapper.helper.js';
import { mapVentaCarritoDelta } from '../../common/helpers/venta-carrito-delta.mapper.js';
import type { AgregarProductoCarritoDto } from './dto/agregar-producto-carrito.dto.js';
import type { EstablecerCantidadProductoDto } from './dto/establecer-cantidad-producto.dto.js';
import type { AgregarPorOmniboxDto } from './dto/agregar-por-omnibox.dto.js';
import type { EliminarLineaCarritoDto } from './dto/eliminar-linea-carrito.dto.js';
import type { EditarGlosaCabeceraDto } from './dto/editar-glosa-cabecera.dto.js';
import type { EditarGlosaLineaDto } from './dto/editar-glosa-linea.dto.js';
import type { AplicarDescuentoGlobalDto } from './dto/aplicar-descuento-global.dto.js';
import type { AsignarClienteDto } from './dto/asignar-cliente.dto.js';
import type { AsignarVendedorDto } from './dto/asignar-vendedor.dto.js';
import type { GuardarTransportistaDto } from './dto/guardar-transportista.dto.js';
import type { SincronizarReferenciasDto } from './dto/sincronizar-referencias.dto.js';
import type {
  GxCarritoDeltaResponse,
  GxMessagesOnlyResponse,
  GxAsignarClienteResponse,
  DeltaCarritoResponseDto,
} from './interfaces/pos-carrito.interfaces.js';

@Injectable()
export class PosCarritoService {
  private readonly logger = new Logger(PosCarritoService.name);

  private static readonly GX = {
    AGREGAR_PRODUCTO: 'POS/AI_API/Venta/xVenta/AgregarProductoCarrito',
    ELIMINAR_LINEA: 'POS/AI_API/Venta/xVenta/EliminarLineaCarrito',
    GLOSA_CABECERA: 'POS/AI_API/Venta/xVenta/EditarGlosaCabecera',
    GLOSA_LINEA: 'POS/AI_API/Venta/xVenta/EditarGlosaLinea',
    DESCUENTO_GLOBAL: 'POS/AI_API/Venta/xVenta/AplicarDescuentoGlobal',
    ASIGNAR_CLIENTE: 'POS/AI_API/Venta/xVenta/AsignarCliente',
    ASIGNAR_VENDEDOR: 'POS/AI_API/Venta/xVenta/AsignarVendedor',
    GUARDAR_TRANSPORTISTA: 'POS/AI_API/Venta/xVenta/GuardarTransportista',
    SINCRONIZAR_REFERENCIAS: 'POS/AI_API/Venta/xVenta/SincronizarReferencias',
  } as const;

  constructor(
    private readonly genexusClient: GenexusClientService,
    private readonly deviceService: DeviceService,
    private readonly productosService: PosProductosService,
  ) {}

  // Token firmado con strControl = EmpKey — misma convención que VentasService/ClientesService.
  private tokenParaEmpresa(ctx: IPosContext): string {
    const strControl = String(ctx.EmpKey).trim();
    const token = this.deviceService.tokenGen(strControl);
    if (!token)
      throw new Error(`No se pudo generar token para strControl=${strControl}`);
    return token;
  }

  // ================================================================
  //  AgregarProductoCarrito — retorna Delta + Totales
  // ================================================================

  async agregarProductoCarrito(
    ctx: IPosContext,
    dto: AgregarProductoCarritoDto,
  ): Promise<DeltaCarritoResponseDto> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] AgregarProductoCarrito → NotaVenta:${dto.notaVentaKey} Producto:${dto.productoKey} Emp:${ctx.EmpKey}`,
    );

    const response = await this.genexusClient.request<GxCarritoDeltaResponse>(
      PosCarritoService.GX.AGREGAR_PRODUCTO,
      {
        EmpKey: ctx.EmpKey,
        PuntoAccesoKey: ctx.PuntoAccesoKey,
        NotaVentaKey: dto.notaVentaKey,
        CategoriaIdl: dto.categoriaIdl,
        Accion: dto.accion,
        ProductoKey: dto.productoKey,
        Cantidad: dto.cantidad,
        LoteKey: dto.loteKey ?? 0,
        Token: this.tokenParaEmpresa(ctx),
      },
      'POST',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response.Messages, 'AgregarProductoCarrito');
    this.logger.log(
      `[SessionHandler] AgregarProductoCarrito OK — NotaVenta:${dto.notaVentaKey}`,
    );
    return mapVentaCarritoDelta(response);
  }

  // ================================================================
  //  EstablecerCantidadProducto — fija cantidad ABSOLUTA (reemplaza, no suma)
  //
  //  AgregarProductoCarrito delega internamente a ProductoEdit_API, que
  //  tiene dos modos según ProductoKey:
  //    - ProductoKey != 0 → inserta/SUMA cantidad a la línea de ese
  //      producto. Accion se IGNORA por completo en este modo (por eso
  //      "Quitar"/"Restar"/"Modificar" nunca restaban — siempre sumaban).
  //    - ProductoKey = 0  → opera sobre la "línea activa", un estado
  //      server-side persistido en un Heap por NotaVentaKey y seteado por
  //      la última línea tocada. Con Accion='PisaCantidadMonto' FIJA la
  //      cantidad de forma absoluta.
  //
  //  Por eso este método encadena dos llamadas: primero "toca" la línea
  //  del producto (Cantidad=0, sin efecto en el monto, solo la deja
  //  activa), luego fija la cantidad absoluta sobre esa línea activa.
  //
  //  ⚠️ La "línea activa" es un estado COMPARTIDO por NotaVentaKey en
  //  GeneXus — evitar disparar este flujo concurrentemente sobre el mismo
  //  carrito (dos productos a la vez), porque la segunda llamada podría
  //  terminar operando sobre la línea que dejó activa la otra.
  // ================================================================

  async establecerCantidadProducto(
    ctx: IPosContext,
    dto: EstablecerCantidadProductoDto,
  ): Promise<DeltaCarritoResponseDto> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);

    // Paso 1: tocar la línea del producto para dejarla "activa" (suma 0)
    await this.agregarProductoCarrito(ctx, {
      notaVentaKey: dto.notaVentaKey,
      accion: 'Agregar',
      productoKey: dto.productoKey,
      cantidad: '0',
    });

    // Paso 2: fijar la cantidad absoluta sobre la línea activa
    this.logger.log(
      `[SessionHandler] EstablecerCantidadProducto → NotaVenta:${dto.notaVentaKey} Producto:${dto.productoKey} Cantidad:${dto.cantidad}`,
    );

    const response = await this.genexusClient.request<GxCarritoDeltaResponse>(
      PosCarritoService.GX.AGREGAR_PRODUCTO,
      {
        EmpKey: ctx.EmpKey,
        PuntoAccesoKey: ctx.PuntoAccesoKey,
        NotaVentaKey: dto.notaVentaKey,
        CategoriaIdl: '',
        Accion: 'PisaCantidadMonto',
        ProductoKey: 0,
        Cantidad: dto.cantidad,
        LoteKey: 0,
        Token: this.tokenParaEmpresa(ctx),
      },
      'POST',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(
      response.Messages,
      'AgregarProductoCarrito(PisaCantidadMonto)',
    );
    this.logger.log(
      `[SessionHandler] EstablecerCantidadProducto OK — NotaVenta:${dto.notaVentaKey}`,
    );
    return mapVentaCarritoDelta(response);
  }

  // ================================================================
  //  AgregarProductoPorOmnibox — Patrón de Resolución + Fail-Fast de lote
  //
  //  Paso 1 (Resolución):    CodigoEscaneado → ProductoKey vía OmniBox.
  //  Paso 2 (Evaluación):    UsaLote && LoteUnicoKey>0 → resuelve el lote
  //                          automáticamente; si es ambiguo (requiere lote
  //                          pero no hay uno único), corta antes de mutar.
  //  Paso 3 (Mutación optimista): AgregarProductoCarrito con el ProductoKey
  //                          (y LoteKey) resueltos.
  //  Paso 4 (Fail-Fast reactivo): si GeneXus igual rechaza por lote
  //                          obligatorio (428, vía gx-error-mapper), se
  //                          recupera GetLotesPorProducto y se reenvía el
  //                          428 con la lista de lotes para que React
  //                          despliegue el selector.
  // ================================================================

  async agregarProductoPorOmnibox(
    ctx: IPosContext,
    dto: AgregarPorOmniboxDto,
  ): Promise<DeltaCarritoResponseDto> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);

    // Paso 1: Resolución — CodigoEscaneado → ProductoKey.
    // Si GeneXus no resuelve el código, resolverOmnibox ya propaga 404.
    const resolucion = await this.productosService.resolverOmnibox(
      ctx,
      dto.codigoEscaneado,
    );

    // Paso 2: Evaluación de lote.
    let loteKey = 0;
    if (resolucion.usaLote) {
      if (resolucion.loteUnicoKey > 0) {
        loteKey = resolucion.loteUnicoKey;
      } else {
        // Ambiguo (múltiples lotes o ninguno determinable de antemano):
        // cortamos ANTES de intentar mutar el carrito.
        throw await this.errorLoteRequerido(ctx, resolucion.productoKey);
      }
    }

    // Paso 3: Mutación optimista con el ProductoKey/LoteKey resueltos.
    try {
      return await this.agregarProductoCarrito(ctx, {
        notaVentaKey: dto.notaVentaKey,
        accion: dto.accion ?? 'Agregar',
        productoKey: resolucion.productoKey,
        cantidad: dto.cantidad ?? '1',
        loteKey,
      });
    } catch (error) {
      // Paso 4: Fail-Fast reactivo — GeneXus rechazó igual por lote
      // obligatorio (p.ej. la resolución quedó desactualizada). Se
      // recupera la lista de lotes y se reenvía el 428 con ese payload.
      const status: number =
        error instanceof HttpException ? error.getStatus() : 0;
      if (status === (HttpStatus.PRECONDITION_REQUIRED as number)) {
        throw await this.errorLoteRequerido(ctx, resolucion.productoKey);
      }
      throw error;
    }
  }

  /** 428 Precondition Required — adjunta la lista de lotes para el selector de React */
  private async errorLoteRequerido(
    ctx: IPosContext,
    productoKey: number,
  ): Promise<HttpException> {
    const lotes = await this.productosService.obtenerLotesPorProducto(
      ctx,
      productoKey,
    );
    return new HttpException(
      {
        message: 'Este producto exige seleccionar un lote',
        code: 'LOTE_REQUERIDO',
        productoKey,
        lotes,
      },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }

  // ================================================================
  //  EliminarLineaCarrito — retorna Delta + Totales
  // ================================================================

  async eliminarLineaCarrito(
    ctx: IPosContext,
    dto: EliminarLineaCarritoDto,
  ): Promise<DeltaCarritoResponseDto> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] EliminarLineaCarrito → NotaVenta:${dto.notaVentaKey} Linea:${dto.notaVentaProductoLinea} Emp:${ctx.EmpKey}`,
    );

    const response = await this.genexusClient.request<GxCarritoDeltaResponse>(
      PosCarritoService.GX.ELIMINAR_LINEA,
      {
        Empkey: ctx.EmpKey,
        Puntoaccesokey: ctx.PuntoAccesoKey,
        Notaventakey: dto.notaVentaKey,
        Notaventaproductolinea: dto.notaVentaProductoLinea,
        Token: this.tokenParaEmpresa(ctx),
      },
      'DELETE',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response.Messages, 'EliminarLineaCarrito');
    this.logger.log(
      `[SessionHandler] EliminarLineaCarrito OK — NotaVenta:${dto.notaVentaKey}`,
    );
    return mapVentaCarritoDelta(response);
  }

  // ================================================================
  //  EditarGlosaCabecera — no retorna Delta, solo Messages
  // ================================================================

  async editarGlosaCabecera(
    ctx: IPosContext,
    dto: EditarGlosaCabeceraDto,
  ): Promise<void> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] EditarGlosaCabecera → NotaVenta:${dto.notaVentaKey} Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`,
    );

    const response = await this.genexusClient.request<GxMessagesOnlyResponse>(
      PosCarritoService.GX.GLOSA_CABECERA,
      {
        EmpKey: ctx.EmpKey,
        PuntoAccesoKey: ctx.PuntoAccesoKey,
        NotaVentaKey: dto.notaVentaKey,
        NotaVentaGlosa: dto.notaVentaGlosa,
        Token: this.tokenParaEmpresa(ctx),
      },
      'PUT',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response, 'EditarGlosaCabecera');
    this.logger.log(
      `[SessionHandler] EditarGlosaCabecera OK — NotaVenta:${dto.notaVentaKey}`,
    );
  }

  // ================================================================
  //  EditarGlosaLinea — retorna Delta + Totales
  // ================================================================

  async editarGlosaLinea(
    ctx: IPosContext,
    dto: EditarGlosaLineaDto,
  ): Promise<DeltaCarritoResponseDto> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] EditarGlosaLinea → NotaVenta:${dto.notaVentaKey} Linea:${dto.notaVentaProductoLinea} Emp:${ctx.EmpKey}`,
    );

    const response = await this.genexusClient.request<GxCarritoDeltaResponse>(
      PosCarritoService.GX.GLOSA_LINEA,
      {
        EmpKey: ctx.EmpKey,
        PuntoAccesoKey: ctx.PuntoAccesoKey,
        NotaVentaKey: dto.notaVentaKey,
        NotaVentaProductoLinea: dto.notaVentaProductoLinea,
        NotaVentaProductoGlosaContenido: dto.notaVentaProductoGlosaContenido,
        LoteKey: dto.loteKey ?? 0,
        Token: this.tokenParaEmpresa(ctx),
      },
      'PUT',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response.Messages, 'EditarGlosaLinea');
    this.logger.log(
      `[SessionHandler] EditarGlosaLinea OK — NotaVenta:${dto.notaVentaKey}`,
    );
    return mapVentaCarritoDelta(response);
  }

  // ================================================================
  //  AplicarDescuentoGlobal — retorna Delta + Totales
  // ================================================================

  async aplicarDescuentoGlobal(
    ctx: IPosContext,
    dto: AplicarDescuentoGlobalDto,
  ): Promise<DeltaCarritoResponseDto> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] AplicarDescuentoGlobal → NotaVenta:${dto.notaVentaKey} Emp:${ctx.EmpKey}`,
    );

    const response = await this.genexusClient.request<GxCarritoDeltaResponse>(
      PosCarritoService.GX.DESCUENTO_GLOBAL,
      {
        EmpKey: ctx.EmpKey,
        PuntoAccesoKey: ctx.PuntoAccesoKey,
        NotaVentaKey: dto.notaVentaKey,
        DescuentoEsPorcentaje: dto.descuentoEsPorcentaje,
        DescuentoPorcentaje: dto.descuentoPorcentaje,
        DescuentoTotal: dto.descuentoTotal,
        GlosaContenido: dto.glosaContenido ?? '',
        Token: this.tokenParaEmpresa(ctx),
      },
      'PUT',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response.Messages, 'AplicarDescuentoGlobal');
    this.logger.log(
      `[SessionHandler] AplicarDescuentoGlobal OK — NotaVenta:${dto.notaVentaKey}`,
    );
    return mapVentaCarritoDelta(response);
  }

  // ================================================================
  //  AsignarCliente — retorna CategoriaIdl (no Delta)
  // ================================================================

  async asignarCliente(
    ctx: IPosContext,
    dto: AsignarClienteDto,
  ): Promise<{ categoriaIdl: string }> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] AsignarCliente → NotaVenta:${dto.notaVentaKey} Cliente:${dto.clienteKey} Emp:${ctx.EmpKey}`,
    );

    const response = await this.genexusClient.request<GxAsignarClienteResponse>(
      PosCarritoService.GX.ASIGNAR_CLIENTE,
      {
        EmpKey: ctx.EmpKey,
        PuntoAccesoKey: ctx.PuntoAccesoKey,
        NotaVentaKey: dto.notaVentaKey,
        ClienteKey: dto.clienteKey,
        Token: this.tokenParaEmpresa(ctx),
      },
      'PUT',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response.Messages, 'AsignarCliente');
    this.logger.log(
      `[SessionHandler] AsignarCliente OK — NotaVenta:${dto.notaVentaKey} CategoriaIdl:${response.CategoriaIdl}`,
    );
    return { categoriaIdl: response.CategoriaIdl };
  }

  // ================================================================
  //  AsignarVendedor — solo Messages
  // ================================================================

  async asignarVendedor(
    ctx: IPosContext,
    dto: AsignarVendedorDto,
  ): Promise<void> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] AsignarVendedor → NotaVenta:${dto.notaVentaKey} Vendedor:${dto.vendedorKey} Emp:${ctx.EmpKey}`,
    );

    const response = await this.genexusClient.request<GxMessagesOnlyResponse>(
      PosCarritoService.GX.ASIGNAR_VENDEDOR,
      {
        EmpKey: ctx.EmpKey,
        PuntoAccesoKey: ctx.PuntoAccesoKey,
        NotaVentaKey: dto.notaVentaKey,
        VendedorKey: dto.vendedorKey,
        Token: this.tokenParaEmpresa(ctx),
      },
      'PUT',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response, 'AsignarVendedor');
    this.logger.log(
      `[SessionHandler] AsignarVendedor OK — NotaVenta:${dto.notaVentaKey}`,
    );
  }

  // ================================================================
  //  GuardarTransportista — solo Messages
  // ================================================================

  async guardarTransportista(
    ctx: IPosContext,
    dto: GuardarTransportistaDto,
  ): Promise<void> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] GuardarTransportista → NotaVenta:${dto.notaVentaKey} Emp:${ctx.EmpKey}`,
    );

    const t = dto.sdtTransportista;
    const response = await this.genexusClient.request<GxMessagesOnlyResponse>(
      PosCarritoService.GX.GUARDAR_TRANSPORTISTA,
      {
        EmpKey: ctx.EmpKey,
        PuntoAccesoKey: ctx.PuntoAccesoKey,
        NotaVentaKey: dto.notaVentaKey,
        SDTTransportista: {
          NotaVentaMotivoTraslado: t.motivoTraslado,
          NotaVentaTipoTraslado: t.tipoTraslado,
          NotaVentaRutChofer: t.rutChofer,
          NotaVentaPatente: t.patente,
          NotaVentaNombreChofer: t.nombreChofer,
          NotaVentaSalidaFecha: t.salidaFecha,
          NotaVentaSalidaHora: t.salidaHora,
          NotaVentaLlegadaHora: t.llegadaHora,
          NotaVentaLlegadaFecha: t.llegadaFecha,
          NotaVentaCarroPatente: t.carroPatente,
        },
        Token: this.tokenParaEmpresa(ctx),
      },
      'PUT',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response, 'GuardarTransportista');
    this.logger.log(
      `[SessionHandler] GuardarTransportista OK — NotaVenta:${dto.notaVentaKey}`,
    );
  }

  // ================================================================
  //  SincronizarReferencias — bulk replace, solo Messages
  // ================================================================

  async sincronizarReferencias(
    ctx: IPosContext,
    dto: SincronizarReferenciasDto,
  ): Promise<void> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] SincronizarReferencias → NotaVenta:${dto.notaVentaKey} count:${dto.referencias.length} Emp:${ctx.EmpKey}`,
    );

    const response = await this.genexusClient.request<GxMessagesOnlyResponse>(
      PosCarritoService.GX.SINCRONIZAR_REFERENCIAS,
      {
        EmpKey: ctx.EmpKey,
        PuntoAccesoKey: ctx.PuntoAccesoKey,
        NotaVentaKey: dto.notaVentaKey,
        SDTReferencias: dto.referencias.map((r) => ({
          TipoDocumento: r.tipoDocumento,
          Folio: r.folio,
          Fecha: r.fecha,
          Razon: r.razon,
        })),
        Token: this.tokenParaEmpresa(ctx),
      },
      'PUT',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response, 'SincronizarReferencias');
    this.logger.log(
      `[SessionHandler] SincronizarReferencias OK — NotaVenta:${dto.notaVentaKey}`,
    );
  }
}
