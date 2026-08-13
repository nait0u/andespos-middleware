import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ParametrosService, ConsumoParametrosService } from '@andestec/api-parametros';

@Controller('parameter')
export class ParameterController {
  private readonly logger = new Logger(ParameterController.name);

  constructor(
    private readonly parametrosService: ParametrosService,
    private readonly consumoParametrosService: ConsumoParametrosService,
  ) {}

  /**
   * GET /parameter/values?app=APP_IDL&alcance=ALCANCE&parametro=PARAM_ID&empkey=EMPKEY&modo=MODO
   * Prueba GetParametro (caché Redis, con refresco automático por vigencia).
   */
  @Get('values')
  async getValues(
    @Query('app') app?: string,
    @Query('alcance') alcance?: string,
    @Query('parametro') parametro?: string,
    @Query('empkey') empkey?: string,
    @Query('modo') modo?: string,
  ) {
    if (!parametro) {
      return { ok: false, error: 'Falta query param ?parametro=PARAMETRO_ID' };
    }

    this.logger.log(
      `Test: obteniendo valor (app="${app}", alcance="${alcance}", parametro="${parametro}")...`,
    );

    const valor = await this.parametrosService.GetParametro(parametro, {
      aplicacionId: app,
      alcanceId: alcance,
      empKey: empkey ? parseInt(empkey, 10) : undefined,
      modo,
    });

    return { ok: true, parametro, valor };
  }

  // ================================================================
  //  TEMPORAL — sesión de debug con el backend de Parámetros.
  //  Borrar estos dos endpoints (y el import de ConsumoParametrosService)
  //  cuando se confirme que la precarga funciona end-to-end.
  // ================================================================

  /**
   * GET /parameter/debug-init?app=CAJA&empkey=1008&alcance=VMDesaConiPos18
   * Llama InicializaParametrosDispositivo/Negocio (la misma llamada del hook
   * de login). El alcance de negocio es igual al DispositivoId (no la Sucursal
   * del perfil) — ver genexus-client.service.ts. Atrapa errores internamente el
   * propio paquete — devuelve {dispositivo:false, negocio:false} en caso de
   * falla, sin detalle del error. Usar junto a "GET /parameter/debug-consumo"
   * para ver el error real.
   */
  @Get('debug-init')
  async debugInit(
    @Query('app') app = 'ServidorPOS',
    @Query('empkey') empkey = '1008',
    @Query('alcance') alcance = 'VMDesaConiPos18',
  ) {
    const empKey = parseInt(empkey, 10);
    return {
      dispositivo: await this.parametrosService.InicializaParametrosDispositivo(app, empKey, 'WebApp'),
      negocio: await this.parametrosService.InicializaParametrosNegocio(app, empKey, alcance, 'WebApp'),
    };
  }

  /**
   * GET /parameter/debug-consumo?app=CAJA&modo=WebApp
   * Llama GetParametroDefinicion directo contra el backend REST, sin el
   * swallow de errores de ParametrosService — devuelve el status HTTP y el
   * body de error reales (401/403/404/500, mensaje de GeneXus, etc.).
   */
  @Get('debug-consumo')
  async debugConsumo(@Query('app') app = 'CAJA', @Query('modo') modo = 'WebApp') {
    try {
      const out = await this.consumoParametrosService.getParametroDefinicion({
        aplicacionIdl: app,
        modo,
      });
      return { ok: true, out };
    } catch (error) {
      const err = error as {
        message: string;
        response?: { status?: number; data?: unknown };
      };
      return {
        ok: false,
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      };
    }
  }

  /**
   * GET /parameter/debug-consumo-values?app=Perfilamiento&parametro=PublicKeyPrfURL&empkey=1008&alcance=VMDesaConiPos18&ambiente=Desarrollo&modo=Escritura
   * Llama GetParametrosValues directo contra el backend REST (sin el swallow
   * de errores de ParametrosService) — para depurar el 403 de GetParametroDefinicion
   * probando el otro endpoint del mismo backend.
   */
  @Get('debug-consumo-values')
  async debugConsumoValues(
    @Query('app') app = 'CAJA',
    @Query('parametro') parametro = '',
    @Query('empkey') empkey = '0',
    @Query('alcance') alcance = '',
    @Query('ambiente') ambiente = 'Desarrollo',
    @Query('modo') modo = 'WebApp',
  ) {
    try {
      const out = await this.consumoParametrosService.getParametrosValues({
        empKey: parseInt(empkey, 10),
        parametroId: parametro,
        alcanceId: alcance,
        ambienteId: ambiente,
        aplicacionIdl: app,
        modo,
      });
      return { ok: true, out };
    } catch (error) {
      const err = error as {
        message: string;
        response?: { status?: number; data?: unknown };
      };
      return {
        ok: false,
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      };
    }
  }
}
