import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import { DeviceService } from '../device/device.service.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import type { GxMessage } from '../../common/interfaces/parameter.interfaces.js';
import type { GuardarClienteDto } from './dto/guardar-cliente.dto.js';
import type { ListaClientesDto } from './dto/lista-clientes.dto.js';
import type {
  IGenexusGuardarClienteResponse,
  IGuardarClienteResponse,
  IGenexusListaClientesResponse,
  IListaClientesResponse,
  IGxClienteListaItem,
  IClienteListaItem,
  IGxComunaItem,
  IComunasResponse,
  IGxCategoriaPrecioItem,
  ICategoriasPrecioResponse,
  IGenexusClienteMatrizResponse,
  IClienteMatrizResponse,
} from './interfaces/clientes.interfaces.js';

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  // Rutas del Objeto API xCliente compilado en GeneXus
  private static readonly GX_XCLIENTE = {
    GUARDAR: 'POS/AI_API/Venta/xCliente/GuardarCliente',
    LISTA: 'POS/AI_API/Venta/xCliente/GetListaClientesPreVenta',
    COMUNAS: 'POS/AI_API/Venta/xCliente/GetComunas',
    CATEGORIAS_PRECIO: 'POS/AI_API/Venta/xCliente/GetCategoriasPrecio',
    CLIENTE_MATRIZ: 'POS/AI_API/Venta/xCliente/GetClienteMatriz',
  } as const;

  constructor(
    private readonly genexusClient: GenexusClientService,
    private readonly deviceService: DeviceService,
  ) {}

  // Token firmado con strControl = EmpKey — convención xCliente GET endpoints.
  private tokenParaEmpresa(ctx: IPosContext): string {
    const strControl = String(ctx.EmpKey).trim();
    const token = this.deviceService.tokenGen(strControl);
    if (!token) throw new Error(`No se pudo generar token para strControl=${strControl}`);
    return token;
  }

  // Token firmado con strControl = "0" — convención xCliente POST endpoints (GetListaClientesPreVenta).
  // GeneXus valida este token con strControl numérico 0 (nivel dispositivo, sin contexto empresa).
  private tokenDispositivo(): string {
    const token = this.deviceService.tokenGen('0');
    if (!token) throw new Error('No se pudo generar token de dispositivo (strControl=0)');
    return token;
  }

  // ================================================================
  //  xCliente API: GuardarCliente
  // ================================================================

  async guardarCliente(
    ctx: IPosContext,
    dto: GuardarClienteDto,
  ): Promise<IGuardarClienteResponse> {
    this.logger.log(
      `[SessionHandler] GuardarCliente → Emp:${ctx.EmpKey} RUT:${dto.clienteRUT}`,
    );

    const response = await this.genexusClient.request<IGenexusGuardarClienteResponse>(
      ClientesService.GX_XCLIENTE.GUARDAR,
      {
        EmpKey: ctx.EmpKey,
        ClienteKeyIn: dto.clienteKeyIn ?? 0,
        SDTClienteEntrada: {
          ClientePITipo: dto.clientePITipo,
          ClientePIValor: dto.clientePIValor,
          ClienteRUT: dto.clienteRUT,
          ClienteRazonSocial: dto.clienteRazonSocial,
          ClienteNombre: dto.clienteNombre,
          ClienteApellidoPaterno: dto.clienteApellidoPaterno,
          ClienteApellidoMaterno: dto.clienteApellidoMaterno,
          ClienteGiro: dto.clienteGiro,
          CategoriaPrecioIdl: dto.categoriaPrecioIdl,
          ClienteEmail: dto.clienteEmail,
          ClienteHomePhone: dto.clienteHomePhone,
          ClienteMobilPhone: dto.clienteMobilPhone,
          ClienteAddress: dto.clienteAddress,
          ClienteComunaId: dto.clienteComunaID,
          ClienteRetieneImpuestos:
            dto.clienteRetieneImpuestos === undefined
              ? undefined
              : dto.clienteRetieneImpuestos
                ? 'S'
                : 'N',
          ClienteMatrizKey: dto.clienteMatrizKey,
        },
        Token: this.tokenParaEmpresa(ctx),
      },
      'POST',
      { target: 'pos', contexto: ctx },
    );

    const error = response.Messages?.find((m) => m.Type === 1);
    if (error) {
      this.logger.error(
        `[SessionHandler] Error GeneXus [GuardarCliente] — ${error.Id}: ${error.Description}`,
      );
      throw new BadRequestException({
        message: error.Description,
        code: error.Id,
        context: 'GuardarCliente',
      });
    }

    this.logger.log(
      `[SessionHandler] GuardarCliente OK — ClienteKeyOut:${response.ClienteKeyOut}`,
    );
    return { clienteKey: response.ClienteKeyOut, mensaje: 'OK' };
  }

  // ================================================================
  //  xCliente API: GetListaClientesPreVenta — búsqueda server-side
  // ================================================================

  async obtenerListaClientes(
    ctx: IPosContext,
    dto: ListaClientesDto,
  ): Promise<IListaClientesResponse> {
    const filtro = (dto.filtroBuscador ?? '').trim();
    this.logger.log(
      `[SessionHandler] GetListaClientesPreVenta → Emp:${ctx.EmpKey} filtro:"${filtro}"`,
    );

    const response = await this.genexusClient.request<IGenexusListaClientesResponse>(
      ClientesService.GX_XCLIENTE.LISTA,
      {
        EmpKey: ctx.EmpKey,
        FiltroBuscador: filtro,
        Token: this.tokenDispositivo(),
      },
      'POST',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'GetListaClientesPreVenta');

    const items = response.SDTClientesLista ?? [];
    const clientes = items.map((item) => this.mapClienteListaItem(item));

    this.logger.log(
      `[SessionHandler] GetListaClientesPreVenta OK — count:${clientes.length}`,
    );
    return { clientes };
  }

  private mapClienteListaItem(item: IGxClienteListaItem): IClienteListaItem {
    return {
      clienteKey: item.ClienteKey,
      clientePITipo: item.ClientePITipo,
      clientePIValor: item.ClientePIValor,
      clienteRUT: item.ClienteRUT,
      clienteNombreCompleto: item.ClienteNombreCompleto,
      clienteRazonSocial: item.ClienteRazonSocial,
      clienteNombre: item.ClienteNombre,
      clienteApellidoPaterno: item.ClienteApellidoPaterno,
      clienteApellidoMaterno: item.ClienteApellidoMaterno,
      clienteGiro: item.ClienteGiro,
      clienteEmail: item.ClienteEmail,
      clienteHomePhone: item.ClienteHomePhone,
      clienteMobilPhone: item.ClienteMobilPhone,
      clienteAddress: item.ClienteAddress,
      clienteComunaId: item.ClienteComunaId,
      clienteRetieneImpuestos:
        item.ClienteRetieneImpuestos === undefined
          ? undefined
          : item.ClienteRetieneImpuestos === 'S',
      categoriaPrecioIdl: item.CategoriaPrecioIdl,
      clienteMatrizKey: item.ClienteMatrizKey,
    };
  }

  // ================================================================
  //  xCliente API: GetComunas
  // ================================================================

  async obtenerComunas(
    ctx: IPosContext,
    textoBusqueda?: string,
  ): Promise<IComunasResponse> {
    const filtro = (textoBusqueda ?? '').trim();
    this.logger.log(
      `[SessionHandler] GetComunas → Emp:${ctx.EmpKey} texto:"${filtro}"`,
    );

    const response = await this.genexusClient.request<IGxComunaItem[]>(
      ClientesService.GX_XCLIENTE.COMUNAS,
      {
        Empkey: ctx.EmpKey,
        Textobusqueda: filtro,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    const items = Array.isArray(response) ? response : [];
    const comunas = items.map((c) => ({
      comunaId: c.ComunaId,
      comunaNombre: c.ComunaNombre,
      comunaCiudad: c.ComunaCiudad,
    }));

    this.logger.log(`[SessionHandler] GetComunas OK — count:${comunas.length}`);
    return { comunas };
  }

  // ================================================================
  //  xCliente API: GetCategoriasPrecio
  // ================================================================

  async obtenerCategoriasPrecio(
    ctx: IPosContext,
  ): Promise<ICategoriasPrecioResponse> {
    this.logger.log(`[SessionHandler] GetCategoriasPrecio → Emp:${ctx.EmpKey}`);

    const response = await this.genexusClient.request<IGxCategoriaPrecioItem[]>(
      ClientesService.GX_XCLIENTE.CATEGORIAS_PRECIO,
      {
        Empkey: ctx.EmpKey,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    const items = Array.isArray(response) ? response : [];
    const categorias = items.map((c) => ({
      categoriaPrecioIdl: c.CategoriaPrecioIdl,
      categoriaPrecioTipo: c.CategoriaPrecioTipo,
    }));

    this.logger.log(
      `[SessionHandler] GetCategoriasPrecio OK — count:${categorias.length}`,
    );
    return { categorias };
  }

  // ================================================================
  //  xCliente API: GetClienteMatriz
  // ================================================================

  async obtenerClienteMatriz(
    ctx: IPosContext,
    rut: string,
    sucursalClienteKey?: number,
  ): Promise<IClienteMatrizResponse> {
    const rutLimpio = (rut ?? '').trim();
    if (!rutLimpio) {
      throw new BadRequestException({
        message: 'El parámetro "rut" es obligatorio',
        context: 'GetClienteMatriz',
      });
    }
    this.logger.log(
      `[SessionHandler] GetClienteMatriz → Emp:${ctx.EmpKey} rut:${rutLimpio} sucursalKey:${sucursalClienteKey ?? 0}`,
    );

    const response = await this.genexusClient.request<IGenexusClienteMatrizResponse>(
      ClientesService.GX_XCLIENTE.CLIENTE_MATRIZ,
      {
        Empkey: ctx.EmpKey,
        Clienterut: rutLimpio,
        Sucursalclientekey: sucursalClienteKey ?? 0,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    this.throwIfErrors(response.Messages, 'GetClienteMatriz');

    const key = Number(response.ClienteMatrizKey ?? 0);
    const requiere = Boolean(response.RequiereSubordinacionOk);
    this.logger.log(
      `[SessionHandler] GetClienteMatriz OK — ClienteMatrizKey:${key} RequiereSubordinacionOk:${requiere}`,
    );
    return {
      requiereSubordinacionOk: requiere,
      clienteMatrizKey: key,
    };
  }

  // ================================================================
  //  Manejo de errores GeneXus
  // ================================================================

  private throwIfErrors(messages: GxMessage[] | undefined, context: string): void {
    if (!messages || messages.length === 0) return;
    const error = messages.find((m) => m.Type === 1);
    if (!error) return;

    this.logger.error(
      `[SessionHandler] Error GeneXus [${context}] — ${error.Id}: ${error.Description}`,
    );
    throw new HttpException(
      { message: error.Description, code: error.Id, context },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}