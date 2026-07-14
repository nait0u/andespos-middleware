import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ContextoPOS } from '../../common/decorators/pos-context.decorator.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { PosClientesService } from './pos-clientes.service.js';
import { ListaClientesXVentaDto } from './dto/lista-clientes-xventa.dto.js';
import { CopiarClienteDto } from './dto/copiar-cliente.dto.js';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto.js';

@UseGuards(PosContextGuard)
@Controller('api/pos/clientes')
export class PosClientesController {
  constructor(private readonly clientesService: PosClientesService) {}

  /** GET /api/pos/clientes?filtroRUT=&filtroNombre=&filtroGenerico= */
  @Get()
  async getClientes(
    @Query() query: ListaClientesXVentaDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return { clientes: await this.clientesService.obtenerClientes(ctx, query) };
  }

  /** POST /api/pos/clientes/shell — crea un registro vacío, retorna ClienteKey */
  @Post('shell')
  async crearClienteShell(@ContextoPOS() ctx: IPosContext) {
    return this.clientesService.crearClienteShell(ctx);
  }

  /** POST /api/pos/clientes/copiar */
  @Post('copiar')
  async copiarCliente(
    @Body() dto: CopiarClienteDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.clientesService.copiarCliente(ctx, dto);
  }

  /** PUT /api/pos/clientes/:clienteKey */
  @Put(':clienteKey')
  async actualizarCliente(
    @Param('clienteKey', ParseIntPipe) clienteKey: number,
    @Body() dto: ActualizarClienteDto,
    @ContextoPOS() ctx: IPosContext,
  ): Promise<{ ok: true }> {
    await this.clientesService.actualizarCliente(ctx, clienteKey, dto);
    return { ok: true };
  }
}
