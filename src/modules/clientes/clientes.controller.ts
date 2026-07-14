import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ContextoPOS } from '../../common/decorators/pos-context.decorator.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { ClientesService } from './clientes.service.js';
import { GuardarClienteDto } from './dto/guardar-cliente.dto.js';
import { ListaClientesDto } from './dto/lista-clientes.dto.js';

/**
 * ClientesController
 *
 * Todos los endpoints están protegidos a nivel de clase por PosContextGuard.
 * El guard valida x-pos-token, verifica el dispositivo y enriquece cada
 * request con un IPosContext consumido vía @ContextoPOS().
 */
@UseGuards(PosContextGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  /**
   * POST /clientes
   *
   * Crea o actualiza un cliente (xCliente/GuardarCliente).
   * Respuesta: { clienteKey, mensaje } — usar clienteKey en crearVenta.
   */
  @Post()
  async guardarCliente(
    @ContextoPOS() ctx: IPosContext,
    @Body() dto: GuardarClienteDto,
  ) {
    return this.clientesService.guardarCliente(ctx, dto);
  }

  /**
   * POST /clientes/lista
   *
   * Búsqueda server-side de clientes (xCliente/GetListaClientesPreVenta).
   * Body: { filtroBuscador: string } — texto libre, sin paginación.
   * Front: disparar con debounce ~300ms en cada cambio del input.
   * Respuesta: { clientes: IClienteListaItem[] } (camelCase).
   */
  @Post('lista')
  async getListaClientes(
    @ContextoPOS() ctx: IPosContext,
    @Body() dto: ListaClientesDto,
  ) {
    return this.clientesService.obtenerListaClientes(ctx, dto);
  }

  /**
   * GET /clientes/comunas?texto=
   *
   * Lista de comunas (xCliente/GetComunas). El parámetro `texto` es opcional
   * para filtrar por nombre.
   * Respuesta: { comunas: { comunaId, comunaDescripcion }[] }
   */
  @Get('comunas')
  async getComunas(
    @ContextoPOS() ctx: IPosContext,
    @Query('texto') texto?: string,
  ) {
    return this.clientesService.obtenerComunas(ctx, texto);
  }

  /**
   * GET /clientes/categorias-precio
   *
   * Categorías de precio disponibles (xCliente/GetCategoriasPrecio).
   * Respuesta: { categorias: { categoriaPrecioIdl, categoriaPrecioDescripcion }[] }
   */
  @Get('categorias-precio')
  async getCategoriasPrecio(@ContextoPOS() ctx: IPosContext) {
    return this.clientesService.obtenerCategoriasPrecio(ctx);
  }

  /**
   * GET /clientes/matriz?rut=&sucursalClienteKey=
   *
   * Busca el cliente matriz asociado a un RUT (xCliente/GetClienteMatriz).
   * `sucursalClienteKey` opcional — usado cuando se está editando una sucursal
   * existente para excluirla del chequeo de subordinación.
   *
   * Respuesta: { requiereSubordinacionOk, clienteMatrizKey }
   * Si clienteMatrizKey > 0, el front debe pasarlo en POST /clientes.
   */
  @Get('matriz')
  async getClienteMatriz(
    @ContextoPOS() ctx: IPosContext,
    @Query('rut') rut: string,
    @Query('sucursalClienteKey') sucursalClienteKey?: string,
  ) {
    const sucursalKey = sucursalClienteKey
      ? Number(sucursalClienteKey)
      : undefined;
    return this.clientesService.obtenerClienteMatriz(ctx, rut, sucursalKey);
  }
}