import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ContextoPOS } from '../../common/decorators/pos-context.decorator.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { PreciosService } from './precios.service.js';
import { FiltrosPreciosDto } from './dto/filtros-precios.dto.js';
import { NovedadesPreciosDto } from './dto/novedades-precios.dto.js';
import { CaducarPrecioDto } from './dto/caducar-precio.dto.js';
import { CrearPrecioDto } from './dto/crear-precio.dto.js';
import { GuardarPrecioDto } from './dto/guardar-precio.dto.js';
import { UploadPreciosDto } from './dto/upload-precios.dto.js';
import type { GxPrecioItem } from './interfaces/precios.interfaces.js';

@UseGuards(PosContextGuard)
@Controller('precios')
export class PreciosController {
  private readonly logger = new Logger(PreciosController.name);

  constructor(private readonly preciosService: PreciosService) {}

  /**
   * POST /precios/lista
   * Lista de precios con filtros opcionales (producto, ubicación, categoría, fecha).
   */
  @Post('lista')
  async getLista(
    @Body() filtros: FiltrosPreciosDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.preciosService.getPrecios(ctx, filtros);
    return {
      precios: (gx.ListaPreciosSDT ?? []).map(this.mapPrecioItem),
      timeStamp: gx.TimeStamp,
    };
  }

  /**
   * POST /precios/novedades
   * Delta-sync de precios modificados desde lastSync.
   * Persistir TimeStampOut de la respuesta como lastSync del próximo ciclo.
   */
  @Post('novedades')
  async getNovedades(
    @Body() filtros: NovedadesPreciosDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.preciosService.getNovedades(ctx, filtros);
    return {
      precios: (gx.ListaPreciosSDT ?? []).map(this.mapPrecioItem),
      timeStampOut: gx.TimeStampOut,
    };
  }

  /**
   * POST /precios/caducar
   * Caduca (da de baja) un precio existente identificado por producto, ubicación,
   * categoría, cantidad y fecha/hora de inicio.
   */
  @Post('caducar')
  async caducar(
    @Body() body: CaducarPrecioDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.preciosService.caducarPrecio(ctx, body);
    return { mensaje: gx.Mensaje, ok: gx.Ok };
  }

  /**
   * POST /precios/crear
   * Crea un precio nuevo para un producto en una ubicación.
   */
  @Post('crear')
  async crear(
    @Body() body: CrearPrecioDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.preciosService.crearPrecio(ctx, body);
    return { mensaje: gx.Mensaje };
  }

  /**
   * POST /precios/guardar
   * Guarda (actualiza) un precio existente con todos sus atributos.
   */
  @Post('guardar')
  async guardar(
    @Body() body: GuardarPrecioDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.preciosService.guardarPrecio(ctx, body);
    return { mensaje: gx.Mensaje };
  }

  /**
   * POST /precios/upload
   * Carga masiva de precios desde un archivo (base64 en fileBlobFile).
   */
  @Post('upload')
  async upload(
    @Body() body: UploadPreciosDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.preciosService.uploadPrecios(ctx, body);
    return { mensaje: gx.Mensaje };
  }

  /**
   * GET /precios/buscar?texto=...
   * Buscador de productos por texto (código interno o descripción).
   */
  @Get('buscar')
  async buscar(
    @Query('texto') texto: string,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.preciosService.buscarProductos(ctx, texto);
    return {
      productos: (gx.ProductoSearchSDT ?? []).map(p => ({
        productoKey:         Number(p.ProductoKey),
        tipoCodDes:          p.TipoCodDes,
        mItemCodVal:         p.MItemCodVal,
        productoDescripcion: p.ProductoDescripcion,
      })),
    };
  }

  /**
   * GET /precios/ubicaciones
   * Lista de ubicaciones disponibles para la empresa del contexto.
   */
  @Get('ubicaciones')
  async getUbicaciones(@ContextoPOS() ctx: IPosContext) {
    const gx = await this.preciosService.getUbicaciones(ctx);
    return {
      ubicaciones: (gx.UbicacionesComboSDT ?? []).map(u => ({
        ubiCod: u.UbiCod,
        ubiNom: u.UbiNom,
      })),
    };
  }

  /**
   * GET /precios/formatos-upload?parmTransConf=...
   * Lista de formatos de archivo soportados para carga masiva.
   */
  @Get('formatos-upload')
  async getFormatosUpload(
    @Query('parmTransConf') parmTransConf: string | undefined,
    @ContextoPOS() ctx: IPosContext,
  ) {
    const gx = await this.preciosService.getFormatosUpload(ctx, parmTransConf);
    return {
      formatos: (gx.FormatosList ?? []).map(f => ({
        id:          f.Id,
        descripcion: f.Descripcion,
      })),
    };
  }

  /**
   * GET /precios/categorias
   * Lista de categorías de precio disponibles para la empresa del contexto.
   */
  @Get('categorias')
  async getCategorias(@ContextoPOS() ctx: IPosContext) {
    const gx = await this.preciosService.getCategorias(ctx);
    return {
      categorias: (gx.CategoriaPrecioSDT ?? []).map(c => ({
        categoriaPrecioIdl:         c.CategoriaPrecioIdl,
        categoriaPrecioDescripcion: c.CategoriaPrecioDescripcion,
        categoriaPrecioTipo:        c.CategoriaPrecioTipo,
      })),
    };
  }

  private mapPrecioItem(p: GxPrecioItem) {
    return {
      empkey:                    Number(p.Empkey),
      productoKey:               Number(p.ProductoKey),
      codIntValor:               p.CodIntValor,
      productoDescripcion:       p.ProductoDescripcion,
      precioTimeInicio:          p.PrecioTimeInicio,
      precioTimeFin:             p.PrecioTimeFin,
      precioHoraInicio:          p.PrecioHoraInicio,
      precioHoraFin:             p.PrecioHoraFin,
      precioUbiCod:              p.PrecioUbiCod,
      ubinom:                    p.Ubinom,
      categoriaPrecioIdl:        p.CategoriaPrecioIdl,
      precioCantidad:            Number(p.PrecioCantidad),
      precioItem:                Number(p.PrecioItem),
      precioDescuentoPorcentaje: Number(p.PrecioDescuentoPorcentaje),
      precioDescuentoMax:        Number(p.PrecioDescuentoMax),
      precioUnidadMedida:        p.PrecioUnidadMedida,
    };
  }
}
