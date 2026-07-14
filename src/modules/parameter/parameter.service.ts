import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHmac } from 'crypto';
import { DeviceService } from '../device/device.service.js';
import type {
  ParameterConfig,
  ParameterValuesParams,
  ParameterDefinitionParams,
  DefinicionParametrosParams,
  SetParametrosValuesBody,
  PersistenciaConVigencia,
  GxBaseResponse,
  SDTParametrosValuesApp,
  SDTParametrosDefinitionApp,
  SDTParametrosDefinicion,
  SDTParametroEstructura,
} from '../../common/interfaces/parameter.interfaces.js';

@Injectable()
export class ParameterService {
  private readonly logger = new Logger(ParameterService.name);

  // ── Constantes fieles al codigo JS original ──────────────────────
  private static readonly HMAC_KEY = '123';
  private static readonly API_PATH = 'Api/ObtencionParametros';
  private static readonly TIMEOUT_DEFAULT_MS = 30000;
  private static readonly VIGENCIA_MAXIMA_MS = 5 * 60 * 1000; // 5 minutos

  /** Cache de configuracion en memoria (se lee del XML una sola vez) */
  private configCache: ParameterConfig | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly deviceService: DeviceService,
  ) {}

  // ================================================================
  //  PATH MANAGEMENT  (rutas distintas a las del device module)
  // ================================================================

  getPathRaiz(): string {
    if (process.platform === 'win32') {
      return join('C:', 'Users', 'Public', 'Enternet2411', 'Dispositivo');
    }
    return '/opt/Dispositivo';
  }

  getPathConfigParametros(): string {
    return join(this.getPathRaiz(), 'DATA', 'AppConfig', 'parms202501.xml');
  }

  getPathPersistenciaParametros(): string {
    if (process.platform === 'win32') {
      return join(
        'C:',
        'Users',
        'Public',
        'Enternet2411',
        'Dispositivo',
        'DATA',
        'Persistencia2411',
        'Parametros2410',
      );
    }
    return join(
      '/opt',
      'Dispositivo',
      'DATA',
      'Persistencia2411',
      'Parametros2410',
    );
  }

  // ================================================================
  //  CONFIGURACION XML  (lectura de parms202501.xml)
  // ================================================================

  /**
   * Lee y parsea parms202501.xml extrayendo HOST, PORT, APP, SECURE.
   * Replica LeerConfiguracion() de UtilesParametros.js usando regex.
   */
  leerConfiguracion(): ParameterConfig {
    const rutaConfig = this.getPathConfigParametros();
    const contenido = readFileSync(rutaConfig, 'utf-8');

    const host =
      contenido.match(/<HOST>(.*?)<\/HOST>/)?.[1]?.trim() || 'localhost';
    const port = parseInt(
      contenido.match(/<PORT>(.*?)<\/PORT>/)?.[1]?.trim() || '80',
      10,
    );
    const appRaw =
      contenido.match(/<APP>(.*?)<\/APP>/)?.[1]?.trim() || '';
    const secure =
      contenido.match(/<SECURE>(.*?)<\/SECURE>/)?.[1]?.trim() === '1';

    // Extraer nombre de la aplicacion (antes de /servlet/ o /)
    const appName = appRaw.replace(/\/servlet\/?$/, '').replace(/\/$/, '');
    const basePath = `/${appName}/${ParameterService.API_PATH}`;

    this.logger.log(
      `[Config] ${secure ? 'https' : 'http'}://${host}:${port}${basePath}`,
    );

    return {
      hostname: host,
      port,
      basePath,
      secure,
      timeout: ParameterService.TIMEOUT_DEFAULT_MS,
    };
  }

  /** Obtiene la configuracion con cache en memoria (replica ObtenerConfiguracion) */
  obtenerConfiguracion(): ParameterConfig {
    if (!this.configCache) {
      this.configCache = this.leerConfiguracion();
    }
    return this.configCache;
  }

  // ================================================================
  //  API KEY  (wrapper de DeviceService.tokenGen)
  // ================================================================

  generarApiKey(strControl: string): string | null {
    return this.deviceService.tokenGen(strControl);
  }

  // ================================================================
  //  PERSISTENCIA PARAMETROS  (mismo algoritmo HMAC-SHA512)
  // ================================================================

  /**
   * Construye la ruta del archivo de persistencia.
   * HMAC-SHA512 con clave '123', hex UPPERCASE, subdirectorios lowercase.
   */
  private buildPersistencePath(tag: string): {
    rutaDirectorio: string;
    rutaArchivo: string;
  } {
    const hashTexto = createHmac('sha512', ParameterService.HMAC_KEY)
      .update(tag)
      .digest('hex')
      .toUpperCase();

    const pathPersistencia = this.getPathPersistenciaParametros();

    const dir1 = hashTexto.substring(0, 2).toLowerCase();
    const dir2 = hashTexto.substring(2, 4).toLowerCase();
    const dir3 = hashTexto.substring(4, 6).toLowerCase();
    const hashRestante = hashTexto.substring(6);

    const nombreArchivo = `${tag}-${hashRestante}.xml`;
    const rutaDirectorio = join(pathPersistencia, dir1, dir2, dir3);
    const rutaArchivo = join(rutaDirectorio, nombreArchivo);

    return { rutaDirectorio, rutaArchivo };
  }

  /** Replica PersistenciaSetParametros de UtilesParametrosPersistencia.js */
  persistenciaSetParametros(tag: string, valor: string): boolean {
    try {
      const { rutaDirectorio, rutaArchivo } = this.buildPersistencePath(tag);
      mkdirSync(rutaDirectorio, { recursive: true });
      writeFileSync(rutaArchivo, valor, 'utf-8');
      this.logger.log(`Persistencia parametros guardada en: ${rutaArchivo}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error al guardar persistencia parametros: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /** Replica PersistenciaGetParametros de UtilesParametrosPersistencia.js */
  persistenciaGetParametros(tag: string): string | null {
    try {
      const { rutaArchivo } = this.buildPersistencePath(tag);
      return readFileSync(rutaArchivo, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Replica PersistenciaGetParametrosConVigencia.
   * Usa statSync para verificar mtime vs TTL (default 5 minutos).
   */
  persistenciaGetParametrosConVigencia(
    tag: string,
    vigenciaMs: number = ParameterService.VIGENCIA_MAXIMA_MS,
  ): PersistenciaConVigencia | null {
    try {
      const { rutaArchivo } = this.buildPersistencePath(tag);

      const stats = statSync(rutaArchivo);
      const diferenciaMs = Date.now() - stats.mtime.getTime();

      const contenido = readFileSync(rutaArchivo, 'utf-8');
      const vigente = diferenciaMs < vigenciaMs;

      this.logger.log(
        `Persistencia [${tag}]: antiguedad ${Math.floor(diferenciaMs / 1000)}s, vigente: ${vigente}`,
      );

      return { contenido, vigente };
    } catch {
      return null;
    }
  }

  // ================================================================
  //  HTTP HELPERS  (HttpService directo — config independiente de GeneXus Device)
  // ================================================================

  /** GET generico hacia la API de ObtencionParametros con ApiKey header */
  private async requestGet<T>(
    endpoint: string,
    params: Record<string, string | number | undefined>,
    apiKey: string,
  ): Promise<T> {
    const config = this.obtenerConfiguracion();
    const protocol = config.secure ? 'https' : 'http';
    const url = `${protocol}://${config.hostname}:${config.port}${config.basePath}${endpoint}`;

    // Filtrar parametros undefined/null/vacios (replica comportamiento JS)
    const cleanParams: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        cleanParams[key] = value;
      }
    }

    const { data } = await firstValueFrom(
      this.httpService.get<T>(url, {
        params: cleanParams,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ApiKey: apiKey,
        },
        timeout: config.timeout,
      }),
    );

    return data;
  }

  /** POST generico hacia la API de ObtencionParametros con ApiKey header */
  private async requestPost<T>(
    endpoint: string,
    body: unknown,
    apiKey: string,
  ): Promise<T> {
    const config = this.obtenerConfiguracion();
    const protocol = config.secure ? 'https' : 'http';
    const url = `${protocol}://${config.hostname}:${config.port}${config.basePath}${endpoint}`;

    const { data } = await firstValueFrom(
      this.httpService.post<T>(url, body, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ApiKey: apiKey,
        },
        timeout: config.timeout,
      }),
    );

    return data;
  }

  // ================================================================
  //  CONSUMOS API  (replicas de ConsumoGet*.js)
  // ================================================================

  /** Replica ConsumoGetParametrosValues.js */
  async consumoGetParametrosValues(
    params: ParameterValuesParams,
  ): Promise<SDTParametrosValuesApp> {
    const strControl = `${(params.Empkey ?? '').toString().trim()}${params.ParametroId || ''}${params.AlcanceId || ''}${params.AmbienteId || ''}${params.Aplicacion_Idl || ''}${params.StringIds || ''}${params.Modo || ''}`;
    const apiKey = this.generarApiKey(strControl);

    if (!apiKey) {
      throw new Error('No se pudo generar el ApiKey (token)');
    }

    return this.requestGet<SDTParametrosValuesApp>(
      '/GetParametrosValues',
      { ...params },
      apiKey,
    );
  }

  /** Replica ConsumoGetParametroDefinicion.js */
  async consumoGetParametroDefinicion(
    params: ParameterDefinitionParams,
  ): Promise<SDTParametrosDefinitionApp> {
    const strControl = params.Aplicacion_Idl || '';
    const apiKey = this.generarApiKey(strControl);

    if (!apiKey) {
      throw new Error('No se pudo generar el ApiKey (token)');
    }

    return this.requestGet<SDTParametrosDefinitionApp>(
      '/GetParametroDefinicion',
      { ...params },
      apiKey,
    );
  }

  /** Replica ConsumoGetDefinicionEstructuras.js */
  async consumoGetDefinicionEstructuras(): Promise<SDTParametroEstructura> {
    const apiKey = this.generarApiKey('');

    if (!apiKey) {
      throw new Error('No se pudo generar el ApiKey (token)');
    }

    return this.requestGet<SDTParametroEstructura>(
      '/GetDefinicionEstructuras',
      {},
      apiKey,
    );
  }

  /** Replica ConsumoGetDefinicionParametros.js */
  async consumoGetDefinicionParametros(
    params: DefinicionParametrosParams,
  ): Promise<SDTParametrosDefinicion> {
    const strControl = params.Listaparametros || '';
    const apiKey = this.generarApiKey(strControl);

    if (!apiKey) {
      throw new Error('No se pudo generar el ApiKey (token)');
    }

    return this.requestGet<SDTParametrosDefinicion>(
      '/GetDefinicionParametros',
      { ...params },
      apiKey,
    );
  }

  /** Replica ConsumoSetParametrosValues.js (POST) */
  async consumoSetParametrosValues(
    datos: SetParametrosValuesBody,
  ): Promise<GxBaseResponse> {
    const strControl = datos.AplicacionIdl || '';
    const apiKey = this.generarApiKey(strControl);

    if (!apiKey) {
      throw new Error('No se pudo generar el ApiKey (token)');
    }

    return this.requestPost<GxBaseResponse>(
      '/SetParametrosValues',
      datos,
      apiKey,
    );
  }

  // ================================================================
  //  CACHE HIBRIDA TTL 5 MIN  (ObtenerParametroDefinicion / Values)
  // ================================================================

  /**
   * Obtiene definiciones de parametros de una aplicacion.
   * Siempre consulta la API y actualiza la persistencia (sin cache TTL).
   */
  async obtenerParametroDefinicion(
    aplicacionIdl: string,
    modo: string = '',
  ): Promise<SDTParametrosDefinitionApp> {
    const tag = `Definicion${aplicacionIdl}`;

    this.logger.log(
      `[Cache] Consultando API de definiciones para "${aplicacionIdl}" (sin cache)...`,
    );

    const resultado = await this.consumoGetParametroDefinicion({
      Aplicacion_Idl: aplicacionIdl,
      Modo: modo,
    });

    if (resultado?.Ok) {
      this.persistenciaSetParametros(tag, JSON.stringify(resultado));
    }

    return resultado;
  }

  /**
   * Obtiene valores de parametros.
   * Si AmbienteId no viene en params, lo obtiene automaticamente del dispositivo.
   * Siempre consulta la API y actualiza la persistencia (sin cache TTL).
   */
  async obtenerParametrosValues(
    params: ParameterValuesParams,
  ): Promise<SDTParametrosValuesApp> {
    // AmbienteId siempre debe venir del dispositivo si no se provee
    if (!params.AmbienteId) {
      const ambienteId = await this.deviceService.getDispositivoAmbiente();
      if (ambienteId) {
        params.AmbienteId = ambienteId;
        this.logger.log(
          `[Config] AmbienteId obtenido del dispositivo: ${ambienteId}`,
        );
      } else {
        this.logger.warn(
          '[Config] No se pudo obtener AmbienteId del dispositivo',
        );
      }
    }

    const tag = `Valores${params.Aplicacion_Idl || ''}${params.AlcanceId || ''}${params.AmbienteId || ''}`;

    this.logger.log('[Cache] Consultando API de parametros (sin cache)...');

    const resultado = await this.consumoGetParametrosValues(params);

    if (resultado?.Ok) {
      this.persistenciaSetParametros(tag, JSON.stringify(resultado));
    }

    return resultado;
  }
}
