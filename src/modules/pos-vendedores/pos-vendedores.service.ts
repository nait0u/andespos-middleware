import { Injectable, Logger } from '@nestjs/common';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import { DeviceService } from '../device/device.service.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { throwGxHttpError } from '../../common/helpers/gx-error-mapper.helper.js';
import type { ListaVendedoresDto } from './dto/lista-vendedores.dto.js';
import type {
  GxGetVendedoresResponse,
  VendedorListItemDto,
} from './interfaces/pos-vendedores.interfaces.js';

@Injectable()
export class PosVendedoresService {
  private readonly logger = new Logger(PosVendedoresService.name);

  private static readonly GX = {
    GET_VENDEDORES: 'POS/AI_API/Venta/xVenta/GetVendedores',
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

  async obtenerVendedores(
    ctx: IPosContext,
    dto: ListaVendedoresDto,
  ): Promise<VendedorListItemDto[]> {
    this.logger.log(
      `[SessionHandler] GetVendedores → Emp:${ctx.EmpKey} Punto:${ctx.PuntoAccesoKey} VendedorActual:${dto.vendedorKey}`,
    );

    const response = await this.genexusClient.request<GxGetVendedoresResponse>(
      PosVendedoresService.GX.GET_VENDEDORES,
      {
        Empkey: ctx.EmpKey,
        Puntoaccesokey: ctx.PuntoAccesoKey,
        Vendedorkey: dto.vendedorKey,
        Vendedorexige: dto.vendedorExige,
        Filtroomnibox: dto.filtroOmniBox,
        Filtrogenerico: dto.filtroGenerico,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response.Messages, 'GetVendedores');
    const items = response.SDTVendedorList ?? [];
    this.logger.log(
      `[SessionHandler] GetVendedores OK — count:${items.length}`,
    );
    return items.map((v) => ({
      usuarioKey: Number(v.UsuarioKey),
      usuarioApodo: v.UsuarioApodo,
      usuarioPIValor: v.UsuarioPIValor,
      usuarioNombreCompleto: v.UsuarioNombreCompleto,
    }));
  }
}
