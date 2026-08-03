import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ContextoPOS } from '../../common/decorators/pos-context.decorator.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { VentasService } from './ventas.service.js';
import { FiltrosVentasDto } from './dto/filtros-ventas.dto.js';
import { CrearVentaDto } from './dto/crear-venta.dto.js';
import { AnularVentaDto } from './dto/anular-venta.dto.js';
import {
  PantallaVentaInitDto,
  PantallaVentaDto,
} from './dto/pantalla-venta.dto.js';
import {
  GetCartaTouchDto,
  GetProductoDetallesDto,
  GetSelectorGeneralDto,
  FiltroCategoriasDto,
} from './dto/catalogo-venta.dto.js';
import { EstadoCajaResponseDto } from './dto/estado-caja.dto.js';
import { GetClientesDto, AsignarClienteDto } from './dto/clientes.dto.js';
import type {
  GxSelectorProductoGeneralItem,
  GxProductoCasificadoraBuscadoraItem,
} from './interfaces/ventas.interfaces.js';

@UseGuards(PosContextGuard)
@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  /**
   * GET /ventas/estado-caja
   *
   * Consulta el estado del turno de caja.
   * Response incluye TurnoCajaKey que debe enviarse en x-pos-turno-caja-key en llamadas posteriores.
   */
  @Get('estado-caja')
  async getEstadoCaja(
    @ContextoPOS() ctx: IPosContext,
  ): Promise<EstadoCajaResponseDto> {
    const gx = await this.ventasService.obtenerEstadoCaja(ctx);
    const dto = new EstadoCajaResponseDto();
    dto.esCaja = gx.EsCaja;
    dto.turnoCajaKey = gx.TurnoCajaKey;
    dto.estadoCaja = gx.EstadoCaja;
    dto.usaMesas = gx.UsaMesas;
    dto.requiereClientePreVenta = gx.RequiereClientePreVenta;
    return dto;
  }

  /**
   * POST /ventas/lista
   *
   * Novedades de ventas desde la última sincronización (delta-sync).
   * Incluir `lastSync` con el TimeStamp de la respuesta anterior para recibir solo cambios.
   */
  @Post('lista')
  async getListaVentas(
    @Body() filtros: FiltrosVentasDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.obtenerListaVentas(ctx, filtros);
    return {
      ventas: (gx.SDTVentas ?? []).map((v) => ({
        notaVentaKey: Number(v.NotaVentaKey),
        notaVentaFecha: v.NotaVentaFecha,
        notaVentaTiempo: v.NotaVentaTiempo,
        clienteNombreCompleto: v.ClienteNombreCompleto,
        notaVentaEstado: v.NotaVentaEstado,
        notaVentaFolioTri: Number(v.NotaVentaFolioTri),
        notaVentaGlosa: v.NotaVentaGlosa,
      })),
      timeStamp: gx.TimeStamp,
    };
  }

  /**
   * POST /ventas
   *
   * Inicia una nueva NotaVenta. Retorna el NotaVentaKey de la venta creada.
   */
  @Post()
  async crearVenta(
    @Body() body: CrearVentaDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.ventasService.crearNuevaVenta(ctx, body);
  }

  /**
   * POST /ventas/anular
   *
   * Anula una NotaVenta existente identificada por notaVentaKey en el body.
   */
  @Post('anular')
  async anularVenta(
    @Body() dto: AnularVentaDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    await this.ventasService.anularVenta(ctx, dto);
    return { ok: true };
  }

  /**
   * GET /ventas/pantalla/init?notaVentaKey=&pmodo=
   *
   * Datos de inicialización de la pantalla de venta: settings, permisos,
   * métodos de pago, reglas de negocio, estado, actores y UIFlags.
   */
  @Get('pantalla/init')
  async getPantallaVentaInit(
    @Query() query: PantallaVentaInitDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.obtenerPantallaVentaInit(ctx, query);
    const s = gx.SDTPantallaVentaInit;
    return {
      settings: {
        usaLectorQR: s.Settings.UsaLectorQR,
        permiteCotizar: s.Settings.PermiteCotizar,
        largoMinimoCodigo: Number(s.Settings.LargoMinimoCodigo),
        tipoDocumentoDefecto: s.Settings.TipoDocumentoDefecto,
        usaComanda: s.Settings.UsaComanda,
        usaProductoLibre: s.Settings.UsaProductoLibre,
        ventasGuiasDespacho: s.Settings.VentasGuiasDespacho,
        modificaPrecioOk: s.Settings.ModificaPrecioOk,
        modificaDescuentoOk: s.Settings.ModificaDescuentoOk,
      },
      permisos: {
        puedeActualizar: s.Permisos.PuedeActualizar,
        recibePagos: s.Permisos.RecibePagos,
        editaVendedor: s.Permisos.EditaVendedor,
        editaGlosa: s.Permisos.EditaGlosa,
        tomaPedidoOk: s.Permisos.TomaPedidoOk,
        despachoOk: s.Permisos.DespachoOk,
      },
      metodosDePago: {
        efectivoOk: s.MetodosDePago.EfectivoOk,
        tarjetaOk: s.MetodosDePago.TarjetaOk,
        convenioOk: s.MetodosDePago.ConvenioOk,
        transferenciaOk: s.MetodosDePago.TransferenciaOk,
        chequeOk: s.MetodosDePago.ChequeOk,
        creditoOk: s.MetodosDePago.CreditoOk,
      },
      reglaDeNegocio: {
        exigeVendedorOk: s.ReglaDeNegocio.ExigeVendedorOk,
        chequeClienteExige: s.ReglaDeNegocio.ChequeClienteExige,
      },
      estado: {
        notaVentaEstado: s.Estado.NotaVentaEstado,
        isEditable: s.Estado.IsEditable,
        redirectURI: s.Estado.RedirectURI,
        emiteBoletaNormalOk: s.Estado.EmiteBoletaNormalOk,
        cantidadComandasPendientes: Number(s.Estado.CantidadComandasPendientes),
        imprimirComandasPendientesOk: s.Estado.ImprimirComandasPendientesOk,
      },
      actores: {
        clienteKey: Number(s.Actores.ClienteKey),
        clienteNombreCompleto: s.Actores.ClienteNombreCompleto,
        clienteGiro: s.Actores.ClienteGiro,
        vendedorKey: Number(s.Actores.VendedorKey),
        vendedorApodo: s.Actores.VendedorApodo,
        vendedorEditOk: s.Actores.VendedorEditOk,
      },
      uiFlags: {
        permiteEmitirGuiaVenta: s.UIFlags.PermiteEmitirGuiaVenta,
        permiteEmitirFactura: s.UIFlags.PermiteEmitirFactura,
        permiteEmitirBoleta: s.UIFlags.PermiteEmitirBoleta,
        permiteEmitirTicketOk: s.UIFlags.PermiteEmitirTicketOk,
        permiteEmitirTicketNoTriOk: s.UIFlags.PermiteEmitirTicketNoTriOk,
        permiteEmitirGuiaTraslado: s.UIFlags.PermiteEmitirGuiaTraslado,
        permiteAgregarReferencia: s.UIFlags.PermiteAgregarReferencia,
        permiteDatosTransportista: s.UIFlags.PermiteDatosTransportista,
        muestraDescuentoGlobalOk: s.UIFlags.MuestraDescuentoGlobalOk,
        vistaInicial: s.UIFlags.VistaInicial,
        muestraCatBuscadoraOk: s.UIFlags.MuestraCatBuscadoraOk,
        muestraTotalPagosOk: s.UIFlags.MuestraTotalPagosOk,
        muestraTotalVueltoOk: s.UIFlags.MuestraTotalVueltoOk,
        muestraTotalBrutoOk: s.UIFlags.MuestraTotalBrutoOk,
        permiteEditarTipoDocTriOk: s.UIFlags.PermiteEditarTipoDocTriOk,
      },
    };
  }

  /**
   * GET /ventas/pantalla/totales?notaVentaKey=
   *
   * Montos, estado del carrito y flags de visualización de la nota de venta activa.
   */
  @Get('pantalla/totales')
  async getPantallaVentaTotales(
    @Query() query: PantallaVentaDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.obtenerVentaTotales(ctx, query);
    const s = gx.SDTVentaTotales;
    return {
      montos: {
        totalBruto: Number(s.Montos.TotalBruto),
        totalPagos: Number(s.Montos.TotalPagos),
        vuelto: Number(s.Montos.Vuelto),
        totalLista: Number(s.Montos.TotalLista),
        vueltoLista: Number(s.Montos.VueltoLista),
        totalAMostrar: Number(s.Montos.TotalAMostrar),
      },
      estadoCarrito: {
        existeProductoOk: s.EstadoCarrito.ExisteProductoOk,
        tieneItemLibreOk: s.EstadoCarrito.TieneItemLibreOk,
        tieneProductoTabOk: s.EstadoCarrito.TieneProductoTabOk,
        existeProductoXEncargarDeliveryOk:
          s.EstadoCarrito.ExisteProductoXEncargarDeliveryOk,
      },
      flags: {
        mostrarTotalOk: s.Flags.MostrarTotalOk,
        mostrarPagosOk: s.Flags.MostrarPagosOk,
        mostrarVueltoOk: s.Flags.MostrarVueltoOk,
        mostrarBtnPagosOk: s.Flags.MostrarBtnPagosOk,
      },
    };
  }

  /**
   * GET /ventas/pantalla/carrito?notaVentaKey=
   *
   * Delta-sync del carrito: items actualizados y líneas eliminadas desde el último TimeStamp.
   */
  @Get('pantalla/carrito')
  async getPantallaVentaCarrito(
    @Query() query: PantallaVentaDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.obtenerVentaCarrito(ctx, query);
    const s = gx.SDTVentaCarrito;
    return {
      sync: { timeStamp: s.Sync.TimeStamp },
      itemsActualizados: (s.ItemsActualizados ?? []).map((i) => ({
        linea: Number(i.Linea),
        productoKey: Number(i.ProductoKey),
        codigoInterno: i.CodigoInterno,
        descripcion: i.Descripcion,
        unidadMedida: i.UnidadMedida,
        cantidad: Number(i.Cantidad),
        precio: Number(i.Precio),
        descuentoMonto: Number(i.DescuentoMonto),
        totalItem: Number(i.TotalItem),
        esNoFacturableOk: i.EsNoFacturableOk,
        editaGlosaOk: i.EditaGlosaOk,
        esAnuladoOk: i.EsAnuladoOk,
        esDescuentoOk: i.EsDescuentoOk,
      })),
      lineasEliminadas: (s.LineasEliminadas ?? []).map((l) => ({
        lineaEliminadaItem: Number(l.LineaEliminadaItem),
      })),
    };
  }

  /**
   * GET /ventas/pantalla/carta-touch?notaVentaKey=
   *
   * Carta touch para selección de productos. notaVentaKey es opcional.
   */
  @Get('pantalla/carta-touch')
  async getCartaTouch(
    @Query() query: GetCartaTouchDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.obtenerCartaTouch(ctx, query);
    return {
      cartaGrupos: (gx.SDTCartaVenta.CartaGrupos ?? []).map((g) => ({
        grupoSelectorIdentificador: g.GrupoSelectorIdentificador,
        grupoSelectorDescripcion: g.GrupoSelectorDescripcion,
        grupoSelectorTouchSelector: g.GrupoSelectorTouchSelector,
        grupoSelectorOrden: Number(g.GrupoSelectorOrden),
        productos: (g.Productos ?? []).map((p) => ({
          productoKey: Number(p.ProductoKey),
          productoCodigo: p.ProductoCodigo,
          productoDescripcion: p.ProductoDescripcion,
          productoUnidadMedida: p.ProductoUnidadMedida,
          productoUnidadMedida2a: p.ProductoUnidadMedida2a,
          productoTratamientoTributario: p.ProductoTratamientoTributario,
          productoActEcoCod: Number(p.ProductoActEcoCod),
          productoActEcoDescripcion: p.ProductoActEcoDescripcion,
          productoStock: Number(p.ProductoStock),
          productoPrecios: this.sanitizarProductoPrecios(p.ProductoPrecios),
          productoModalidadVenta: Number(p.ProductoModalidadVenta),
          productoTieneStock: p.ProductoTieneStock,
          productoVendeLote: p.ProductoVendeLote,
          itemInformacionAdicional: p.ItemInformacionAdicional,
        })),
      })),
    };
  }

  /**
   * GET /ventas/pantalla/producto-detalles?mitemKey=
   *
   * Detalles de un producto: nombre, imágenes, stock por localización y glosa técnica.
   * mitemKey es obligatorio.
   */
  @Get('pantalla/producto-detalles')
  async getProductoDetalles(
    @Query() query: GetProductoDetallesDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.obtenerProductoDetalles(ctx, query);
    const s = gx.SDTDetalleProductoVenta;
    return {
      mItemNom: s.MItemNom,
      imagenesURI: s.ImagenesURI,
      stockXLocalizacion: (s.StockXLocalizacion ?? []).map((sl) => ({
        puntoAccesoDescripcion: sl.PuntoAccesoDescripcion,
        productoStockCantidadInventario: Number(
          sl.ProductoStockCantidadInventario,
        ),
        puntoAccesoStockLocalizacion: sl.PuntoAccesoStockLocalizacion,
      })),
      glosaTecnica: (s.GlosaTecnica ?? []).map((gt) => ({
        categoriaNombre: gt.CategoriaNombre,
        propiedadDescripcion: gt.PropiedadDescripcion,
        propiedadValor: gt.PropiedadValor,
      })),
    };
  }

  /**
   * GET /ventas/pantalla/selector-general?textoBusqueda=&codigoBusqueda=
   *
   * Búsqueda libre de productos por texto o código.
   */
  @Get('pantalla/selector-general')
  async getSelectorGeneral(
    @Query() query: GetSelectorGeneralDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.obtenerSelectorGeneral(ctx, query);
    return {
      mostrarBotonVer: gx.MostrarBotonVer,
      productos: this.mapSelectorGeneralItems(gx.SDTSelectorProductoGeneral),
    };
  }

  /**
   * GET /ventas/pantalla/categorias-menu?limit=50&offset=0
   *
   * Categorías clasificadoras y buscadoras del menú, con caché TTL 1h en el BFF
   * y paginación local sobre los arrays retornados por GeneXus.
   */
  @Get('pantalla/categorias-menu')
  async getCategoriasMenu(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.ventasService.obtenerCategoriasMenuPaginado(ctx, limit, offset);
  }

  /**
   * POST /ventas/pantalla/filtro-categorias
   *
   * Filtra el selector de productos aplicando arrays de categorías
   * clasificadoras y buscadoras seleccionadas por el usuario.
   */
  @Post('pantalla/filtro-categorias')
  async postFiltrarCategorias(
    @Body() dto: FiltroCategoriasDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.filtrarCategorias(ctx, dto);
    return {
      mostrarBotonVer: gx.MostrarBotonVer,
      productos: this.mapFiltroCategoriasItems(gx.SDTSelectorCategorias),
    };
  }

  /**
   * GET /ventas/clientes?filtroRut=&filtroNombre=&filtroGenerico=
   *
   * Búsqueda de clientes por RUT, nombre o filtro genérico. El front NO debe
   * llamar a GeneXus directamente para esto — pasa siempre por este BFF.
   */
  @Get('clientes')
  async getClientes(
    @Query() query: GetClientesDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.obtenerClientes(ctx, query);
    return {
      clientes: (gx.SDTClienteList ?? []).map((c) => ({
        clienteKey: Number(c.ClienteKey),
        clienteRut: c.ClienteRUT,
        clienteNombreCompleto: c.ClienteNombreCompleto,
        clienteGiro: c.ClienteGiro,
        clienteAddress: c.ClienteAddress,
        clientePIValor: c.ClientePIValor,
      })),
    };
  }

  /**
   * PUT /ventas/clientes/asignar
   *
   * Asigna un cliente existente a la NotaVenta activa.
   */
  @Put('clientes/asignar')
  async putAsignarCliente(
    @Body() dto: AsignarClienteDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.ventasService.asignarCliente(ctx, dto);
    return { categoriaIdl: gx.CategoriaIdl };
  }

  /**
   * GetSelectorProductoGeneral — PrecioPicture/CantidadPicture son strings
   * "Picture" de GeneXus (ya formateados para mostrar); NO se parsean con
   * Number(), se exponen tal cual al frontend.
   */
  private mapSelectorGeneralItems(items: GxSelectorProductoGeneralItem[]) {
    return (items ?? []).map((p) => ({
      productoKey: Number(p.ProductoKey),
      tipoCodDes: p.TipoCodDes,
      mItemCodVal: p.MItemCodVal,
      productoDescripcion: p.ProductoDescripcion,
      precioPicture: p.PrecioPicture,
      cantidadPicture: p.CantidadPicture,
      unidadMedida: p.MItemPropiaUniItmId_,
      productoVendeLote: p.ProductoVendeLote,
      itemInformacionAdicional: p.ItemInformacionAdicional,
    }));
  }

  /**
   * GeneXus a veces retorna 'PreciosX' (string por defecto sin dato real)
   * o el precio crudo sin formato (ej. '4500.000000'); acá se normaliza a
   * moneda chilena o '$ 0' si no hay precio.
   */
  private sanitizarProductoPrecios(valor: unknown): string {
    if (valor == null || valor === 'PreciosX') return '$ 0';

    const precioNum = Number(valor);
    if (Number.isNaN(precioNum)) return '$ 0';

    return `$ ${Math.round(precioNum).toLocaleString('es-CL')}`;
  }

  /**
   * GetSelectorFiltroCategorias — shape distinto a GetSelectorProductoGeneral:
   * PrecioItem/Stock acá SÍ son numéricos crudos, no Picture.
   */
  private mapFiltroCategoriasItems(
    items: GxProductoCasificadoraBuscadoraItem[],
  ) {
    return (items ?? []).map((p) => ({
      mItemKey: Number(p.MItemKey),
      mItemNom: p.MItemNom,
      codigo: p.Codigo,
      categoria: p.Categoria,
      precioItem: Number(p.PrecioItem),
      stock: Number(p.Stock),
    }));
  }
}
