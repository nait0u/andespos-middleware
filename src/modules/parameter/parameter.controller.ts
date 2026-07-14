import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ParameterService } from './parameter.service.js';

@Controller('parameter')
export class ParameterController {
  private readonly logger = new Logger(ParameterController.name);

  constructor(private readonly parameterService: ParameterService) {}

  /**
   * GET /parameter/config
   * Prueba la lectura de parms202501.xml.
   */
  @Get('config')
  getConfig() {
    this.logger.log('Test: leyendo configuracion de parametros...');

    const config = this.parameterService.leerConfiguracion();

    return {
      ok: !!config,
      configuracion: config,
      pathConfig: this.parameterService.getPathConfigParametros(),
    };
  }

  /**
   * GET /parameter/definitions?app=APP_IDL
   * Prueba obtenerParametroDefinicion (con cache TTL 5 min).
   */
  @Get('definitions')
  async getDefinitions(
    @Query('app') app: string,
    @Query('modo') modo?: string,
  ) {
    this.logger.log(
      `Test: obteniendo definiciones para app="${app}", modo="${modo ?? ''}"...`,
    );

    if (!app) {
      return { ok: false, error: 'Falta query param ?app=APP_IDL' };
    }

    const resultado = await this.parameterService.obtenerParametroDefinicion(
      app,
      modo ?? '',
    );

    return {
      ok: resultado?.Ok ?? false,
      resultado,
    };
  }

  /**
   * GET /parameter/values?app=APP_IDL&alcance=ALCANCE&parametro=PARAM_ID
   * Prueba obtenerParametrosValues (con cache TTL 5 min).
   * AmbienteId se obtiene automaticamente del dispositivo.
   */
  @Get('values')
  async getValues(
    @Query('app') app?: string,
    @Query('alcance') alcance?: string,
    @Query('parametro') parametro?: string,
    @Query('empkey') empkey?: string,
  ) {
    this.logger.log(
      `Test: obteniendo valores (app="${app}", alcance="${alcance}", parametro="${parametro}")...`,
    );

    const resultado = await this.parameterService.obtenerParametrosValues({
      Aplicacion_Idl: app,
      AlcanceId: alcance,
      Empkey: empkey ? parseInt(empkey, 10) : undefined,
    });

    if (parametro && resultado?.Ok) {
      const lista = (
        resultado as unknown as {
          ParametrosValuesApp?: { ParametroValueArray?: unknown[] };
        }
      ).ParametrosValuesApp?.ParametroValueArray;
      const items = Array.isArray(lista) ? lista : [];
      const match = items.find(
        (it) =>
          (it as { ParametroId?: string })?.ParametroId === parametro,
      );
      return {
        ok: true,
        resultado: {
          Ok: true,
          ParametrosValuesApp: {
            ParametroValueArray: match ? [match] : [],
          },
        },
      };
    }

    return {
      ok: resultado?.Ok ?? false,
      resultado,
    };
  }

  /**
   * GET /parameter/structures
   * Prueba consumoGetDefinicionEstructuras.
   */
  @Get('structures')
  async getStructures() {
    this.logger.log('Test: obteniendo estructuras...');

    const resultado =
      await this.parameterService.consumoGetDefinicionEstructuras();

    return {
      ok: resultado?.Ok ?? false,
      resultado,
    };
  }
}
