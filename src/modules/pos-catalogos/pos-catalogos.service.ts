import { Injectable, Logger } from '@nestjs/common';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import { TokenService } from '@andestec/api-dispositivos';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { throwGxHttpError } from '../../common/helpers/gx-error-mapper.helper.js';
import type {
  GxCatalogoResponse,
  CatalogoItemDto,
} from './interfaces/pos-catalogos.interfaces.js';

@Injectable()
export class PosCatalogosService {
  private readonly logger = new Logger(PosCatalogosService.name);

  private static readonly GX = {
    TRATAMIENTO_TRIBUTARIO: 'POS/AI_API/Venta/xVenta/GetTratamientoTributario',
    UNIDADES_MEDIDA: 'POS/AI_API/Venta/xVenta/GetCatalogoUnidadesMedida',
    IMPUESTOS_ESPECIALES:
      'POS/AI_API/Venta/xVenta/GetCatalogoImpuestosEspeciales',
    MOTIVOS_TRASLADO: 'POS/AI_API/Venta/xVenta/GetMotivosTraslado',
    TIPOS_TRASLADO: 'POS/AI_API/Venta/xVenta/GetTiposTraslado',
    ACTIVIDADES_ECO: 'POS/AI_API/Venta/xVenta/GetCatalogoActividadesEco',
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

  private async obtenerCatalogo(
    ctx: IPosContext,
    endpoint: string,
    contexto: string,
  ): Promise<CatalogoItemDto[]> {
    this.logger.log(
      `[SessionHandler] ${contexto} → Emp:${ctx.EmpKey} Dispositivo:${ctx.DispositivoId}`,
    );

    const response = await this.genexusClient.request<GxCatalogoResponse>(
      endpoint,
      {
        Empkey: ctx.EmpKey,
        Token: this.tokenParaEmpresa(ctx),
      },
      'GET',
      { target: 'pos', contexto: ctx },
    );

    throwGxHttpError(response.Messages, contexto);
    const items = response.SDTCatalogo ?? [];
    this.logger.log(`[SessionHandler] ${contexto} OK — count:${items.length}`);
    return items.map((i) => ({ codigo: i.Codigo, descripcion: i.Descripcion }));
  }

  async obtenerTratamientoTributario(
    ctx: IPosContext,
  ): Promise<CatalogoItemDto[]> {
    return this.obtenerCatalogo(
      ctx,
      PosCatalogosService.GX.TRATAMIENTO_TRIBUTARIO,
      'GetTratamientoTributario',
    );
  }

  async obtenerUnidadesMedida(ctx: IPosContext): Promise<CatalogoItemDto[]> {
    return this.obtenerCatalogo(
      ctx,
      PosCatalogosService.GX.UNIDADES_MEDIDA,
      'GetCatalogoUnidadesMedida',
    );
  }

  async obtenerImpuestosEspeciales(
    ctx: IPosContext,
  ): Promise<CatalogoItemDto[]> {
    return this.obtenerCatalogo(
      ctx,
      PosCatalogosService.GX.IMPUESTOS_ESPECIALES,
      'GetCatalogoImpuestosEspeciales',
    );
  }

  async obtenerMotivosTraslado(ctx: IPosContext): Promise<CatalogoItemDto[]> {
    return this.obtenerCatalogo(
      ctx,
      PosCatalogosService.GX.MOTIVOS_TRASLADO,
      'GetMotivosTraslado',
    );
  }

  async obtenerTiposTraslado(ctx: IPosContext): Promise<CatalogoItemDto[]> {
    return this.obtenerCatalogo(
      ctx,
      PosCatalogosService.GX.TIPOS_TRASLADO,
      'GetTiposTraslado',
    );
  }

  async obtenerActividadesEconomicas(
    ctx: IPosContext,
  ): Promise<CatalogoItemDto[]> {
    return this.obtenerCatalogo(
      ctx,
      PosCatalogosService.GX.ACTIVIDADES_ECO,
      'GetCatalogoActividadesEco',
    );
  }
}
