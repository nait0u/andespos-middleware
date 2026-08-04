import { Injectable, Logger } from '@nestjs/common';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import { TokenService } from '@andestec/api-dispositivos';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import {
  throwGxHttpError,
  assertContextoCompleto,
} from '../../common/helpers/gx-error-mapper.helper.js';
import type { ListaClientesXVentaDto } from './dto/lista-clientes-xventa.dto.js';
import type { CopiarClienteDto } from './dto/copiar-cliente.dto.js';
import type { ActualizarClienteDto } from './dto/actualizar-cliente.dto.js';
import type {
  GxGetClientesResponse,
  ClienteListItemDto,
  GxCrearClienteShellResponse,
  GxCopiarClienteResponse,
  GxMessagesOnlyResponse,
} from './interfaces/pos-clientes.interfaces.js';

/**
 * PosClientesService — módulo de clientes de xVenta (GetClientes,
 * CrearClienteShell, CopiarCliente, ActualizarCliente).
 *
 * No confundir con ClientesService (src/modules/clientes) — ese consume
 * el objeto GeneXus xCliente (GuardarCliente, GetListaClientesPreVenta),
 * una API distinta y anterior. Ambos coexisten sin conflicto de rutas.
 */
@Injectable()
export class PosClientesService {
  private readonly logger = new Logger(PosClientesService.name);

  private static readonly GX = {
    GET_CLIENTES: 'POS/AI_API/Venta/xVenta/GetClientes',
    CREAR_SHELL: 'POS/AI_API/Venta/xVenta/CrearClienteShell',
    COPIAR: 'POS/AI_API/Venta/xVenta/CopiarCliente',
    ACTUALIZAR: 'POS/AI_API/Venta/xVenta/ActualizarCliente',
  } as const;

  constructor(
    private readonly genexusClient: GenexusClientService,
    private readonly tokenService: TokenService,
  ) {}

  private tokenParaEmpresa(ctx: IPosContext): string {
    const strControl = String(ctx.EmpKey).trim();
    const token = this.tokenService.TokenGen(strControl);
    if (!token)
      throw new Error(`No se pudo generar token para strControl=${strControl}`);
    return token;
  }

  // ================================================================
  //  GetClientes
  // ================================================================

  async obtenerClientes(
    ctx: IPosContext,
    dto: ListaClientesXVentaDto,
  ): Promise<ClienteListItemDto[]> {
    this.logger.log(
      `[SessionHandler] GetClientes → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`,
    );

    const response = await this.genexusClient.request<GxGetClientesResponse>(
      PosClientesService.GX.GET_CLIENTES,
      {
        Empkey: ctx.EmpKey,
        Filtrorut: dto.filtroRUT,
        Filtronombre: dto.filtroNombre,
        Filtrogenerico: dto.filtroGenerico,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response.Messages, 'GetClientes');
    const items = response.SDTClienteList ?? [];
    this.logger.log(`[SessionHandler] GetClientes OK — count:${items.length}`);
    return items.map((c) => ({
      clienteKey: Number(c.ClienteKey),
      clienteRUT: c.ClienteRUT,
      clienteNombreCompleto: c.ClienteNombreCompleto,
      clienteGiro: c.ClienteGiro,
      clienteAddress: c.ClienteAddress,
    }));
  }

  // ================================================================
  //  CrearClienteShell
  // ================================================================

  async crearClienteShell(ctx: IPosContext): Promise<{ clienteKey: number }> {
    this.logger.log(`[SessionHandler] CrearClienteShell → Emp:${ctx.EmpKey}`);

    const response =
      await this.genexusClient.request<GxCrearClienteShellResponse>(
        PosClientesService.GX.CREAR_SHELL,
        {
          EmpKey: ctx.EmpKey,
          Token: this.tokenParaEmpresa(ctx),
        },
        'POST',
        { target: 'pos', contexto: ctx },
      );

    throwGxHttpError(response.Messages, 'CrearClienteShell');
    this.logger.log(
      `[SessionHandler] CrearClienteShell OK — ClienteKey:${response.ClienteKey}`,
    );
    return { clienteKey: Number(response.ClienteKey) };
  }

  // ================================================================
  //  CopiarCliente
  // ================================================================

  async copiarCliente(
    ctx: IPosContext,
    dto: CopiarClienteDto,
  ): Promise<{ clienteKeyNew: number }> {
    this.logger.log(
      `[SessionHandler] CopiarCliente → ClienteOrigen:${dto.clienteKeyOrigen} Emp:${ctx.EmpKey}`,
    );

    const response = await this.genexusClient.request<GxCopiarClienteResponse>(
      PosClientesService.GX.COPIAR,
      {
        EmpKey: ctx.EmpKey,
        ClienteKeyOrigen: dto.clienteKeyOrigen,
        ClientePIValorNew: dto.clientePIValorNew,
        ClienteAddressNew: dto.clienteAddressNew,
        ClienteComunaIDNew: dto.clienteComunaIDNew,
        Token: this.tokenParaEmpresa(ctx),
      },
      'POST',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response.Messages, 'CopiarCliente');
    this.logger.log(
      `[SessionHandler] CopiarCliente OK — ClienteKeyNew:${response.ClienteKeyNew}`,
    );
    return { clienteKeyNew: Number(response.ClienteKeyNew) };
  }

  // ================================================================
  //  ActualizarCliente
  // ================================================================

  async actualizarCliente(
    ctx: IPosContext,
    clienteKey: number,
    dto: ActualizarClienteDto,
  ): Promise<void> {
    assertContextoCompleto(ctx.EmpKey, ctx.PuntoAccesoKey);
    this.logger.log(
      `[SessionHandler] ActualizarCliente → Cliente:${clienteKey} Emp:${ctx.EmpKey}`,
    );

    const response = await this.genexusClient.request<GxMessagesOnlyResponse>(
      PosClientesService.GX.ACTUALIZAR,
      {
        EmpKey: ctx.EmpKey,
        ClienteKey: clienteKey,
        SDTClientePayload: {
          ClienteRUT: dto.clienteRUT,
          ClienteGiro: dto.clienteGiro,
          ClienteAddress: dto.clienteAddress,
          ClienteComunaId: dto.clienteComunaId,
          ClienteMobilPhone: dto.clienteMobilPhone,
          ClienteEmail: dto.clienteEmail,
          ClienteNombre: dto.clienteNombre,
          ClienteApellidoPaterno: dto.clienteApellidoPaterno,
          ClienteApellidoMaterno: dto.clienteApellidoMaterno,
          ClienteRazonSocial: dto.clienteRazonSocial,
        },
        Token: this.tokenParaEmpresa(ctx),
      },
      'PUT',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response, 'ActualizarCliente');
    this.logger.log(
      `[SessionHandler] ActualizarCliente OK — Cliente:${clienteKey}`,
    );
  }
}
