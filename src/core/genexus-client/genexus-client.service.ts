import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { join } from 'path';
import { readFileSync } from 'fs';
import type { DeviceConfig } from '../../common/interfaces/device.interfaces.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { PERFIL_CONFIG } from '../../common/constants/perfil-config.js';
import { DeviceService } from '../../modules/device/device.service.js';

export interface GxRequestOptions {
  headers?: Record<string, string>;
  /** 'admin' → AdministradorDispositivos (LocationAdministradorDispositivos.txt)
   *  'pos'   → AndesPOS_API2602N (GX_POS_BASE_URL env var) */
  target?: 'admin' | 'pos';
  /** Contexto POS del request — requerido para target 'pos'. El session-handler
   *  usa DispositivoId como clave de sesión Tomcat. */
  contexto?: IPosContext;
}

/**
 * Capa centralizada de HTTP hacia el monolito GeneXus.
 *
 * Responsabilidades:
 *  1. Leer LocationAdministradorDispositivos.txt para armar la baseURL.
 *  2. Gestionar el ciclo de vida de la sesión Tomcat (lazy-init + retry).
 *  3. Ejecutar GET / POST preservando exactamente los parámetros que GeneXus espera.
 *  4. Clasificar y relanzar errores de red/timeout como excepciones NestJS.
 */
@Injectable()
export class GenexusClientService {
  private readonly logger = new Logger(GenexusClientService.name);
  private readonly sessionCookies = new Map<string, string>();
  private readonly sessionEmpKeys = new Map<string, number>();
  private sessionInitPromises = new Map<string, Promise<void>>();
  private static readonly SESSION_ERROR_CODES = new Set([401, 403, 500]);

  constructor(
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => DeviceService))
    private readonly deviceService: DeviceService,
  ) {}

  // ================================================================
  //  CONFIGURACIÓN
  // ================================================================

  private getPathDispositivo(): string {
    const raiz =
      process.platform === 'win32'
        ? 'C:\\Program Files\\Apache Software Foundation\\Tomcat 8.5\\webapps'
        : '/opt/Dispositivo';
    return join(raiz, 'DATA', 'Dispositivo24');
  }

  leerConfiguracion(): DeviceConfig {
    const rutaConfig = join(
      this.getPathDispositivo(),
      'LocationAdministradorDispositivos.txt',
    );
    const contenido = readFileSync(rutaConfig, 'utf-8');
    const linea = contenido.split('\n')[0].trim();
    const partes = linea.split(';');

    if (partes.length < 5) {
      throw new Error(
        'Formato de LocationAdministradorDispositivos.txt invalido',
      );
    }

    return {
      host: partes[0],
      port: parseInt(partes[1], 10),
      baseUrl: partes[2],
      timeout: parseInt(partes[3], 10) * 1000,
      secure: parseInt(partes[4], 10) === 1,
    };
  }

  private buildBaseUrl(config: DeviceConfig): string {
    const protocol = config.secure ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}${config.baseUrl}`;
  }

  private buildUrl(
    endpoint: string,
    target: 'admin' | 'pos' = 'admin',
  ): string {
    if (target === 'pos') {
      const base = process.env.GX_POS_BASE_URL;
      if (!base) throw new Error('GX_POS_BASE_URL no está configurado en .env');
      return `${base.endsWith('/') ? base : base + '/'}${endpoint}`;
    }
    const config = this.leerConfiguracion();
    return `${this.buildBaseUrl(config)}${endpoint}`;
  }

  // ================================================================
  //  SESSION HANDLER — lazy-init + retry
  // ================================================================

  /**
   * Clave de sesión Tomcat: `${DispositivoId}::${Perfil}`.
   *
   * Un mismo dispositivo físico puede operar bajo perfiles distintos
   * (admin vs cajero) y cada perfil requiere su propio `InicializarContexto`
   * — el `S_InicializarContexto` de GeneXus puebla env-vars (PuntoAccesoEnvSet,
   * EsCajaEnvSet, LoadContextoPos, etc.) en función del perfil; reutilizar la
   * cookie del perfil anterior deja `SDTContextoVenta` con datos del perfil
   * equivocado (o vacío) y los procedures de venta tiran HTTP 412.
   */
  private sessionKey(ctx: IPosContext): string {
    return `${ctx.DispositivoId}::${ctx.Perfil ?? ''}`;
  }

  async ensureSessionInitialized(contexto: IPosContext): Promise<void> {
    const sessionId = this.sessionKey(contexto);
    if (this.sessionCookies.has(sessionId)) return;

    const pending = this.sessionInitPromises.get(sessionId);
    if (pending) return pending;

    const promise = this.initializeSession(contexto).finally(() => {
      this.sessionInitPromises.delete(sessionId);
    });
    this.sessionInitPromises.set(sessionId, promise);
    return promise;
  }

  /** EmpKey autoritativo devuelto por GeneXus en InicializarContexto, keyed por DispositivoId+Perfil */
  getEmpKeyForSession(contexto: IPosContext): number | undefined {
    return this.sessionEmpKeys.get(this.sessionKey(contexto));
  }

  private async initializeSession(contexto: IPosContext): Promise<void> {
    const sessionId = this.sessionKey(contexto);
    const url = this.buildUrl(
      'POS/AI_API/Sesion/SessionAPI/InicializarContexto',
      'pos',
    );
    const config = this.leerConfiguracion();

    const perfilKey = contexto.Perfil;
    const perfilConfig = perfilKey ? PERFIL_CONFIG[perfilKey] : undefined;
    if (!perfilConfig) {
      this.logger.error(
        `[SessionHandler] Perfil no configurado en el middleware: ${perfilKey ?? '(vacío)'}`,
      );
      throw new InternalServerErrorException(
        `Perfil no configurado en el middleware: ${perfilKey ?? '(vacío)'}`,
      );
    }

    // Token B2B requerido por InicializarContexto — strControl = RutEmpresa + RutUsuario
    // (lo que GeneXus reconstruye en APIDispositivos.TokenVal para validar el hash).
    const token =
      this.deviceService.tokenGen(
        `${perfilConfig.RutEmpresa}${perfilConfig.RutUsuario}`,
      ) ?? '';
    if (!token) {
      this.logger.warn(
        `[SessionHandler] No se pudo generar token B2B para sesión ${sessionId}`,
      );
    }

    // EmpKey no forma parte del schema SDTIniSessionTest — GeneXus lo deriva de PuntoAccesoKey/RutEmpresa
    // y lo devuelve en la respuesta (InicializarContextoOutput.EmpKey).
    const payload = {
      SDTIniSessionTest: {
        PuntoAccesoKey: perfilConfig.PuntoAccesoKey,
        EstacionIdl: perfilConfig.EstacionIdl,
        ModoConexion: perfilConfig.ModoConexion,
        ModuloAplicacionIdl: perfilConfig.ModuloAplicacionIdl,
        Mandante: perfilConfig.Mandante,
        RutEmpresa: perfilConfig.RutEmpresa,
        Sucursal: perfilConfig.Sucursal,
        RutUsuario: perfilConfig.RutUsuario,
        RutUsuarioDV: perfilConfig.RutUsuarioDV,
        Nombre: perfilConfig.Nombre,
        Perfil: perfilConfig.Perfil,
        PerfilDesc: perfilConfig.PerfilDesc,
      },
      token,
    };

    this.logger.log(
      `[SessionHandler] Inicializando sesión para dispositivo: ${sessionId}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          Ok: boolean;
          EmpKey: number;
          Messages?: { Type: number; Description: string }[];
        }>(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: config.timeout,
          withCredentials: true,
        }),
      );

      if (!response.data.Ok) {
        const msg =
          response.data.Messages?.find((m) => m.Type === 1)?.Description ??
          'InicializarContexto devolvió Ok=false sin detalle';
        this.logger.error(
          `[SessionHandler] GeneXus rechazó la sesión [${sessionId}]: ${msg}`,
        );
        throw new Error(msg);
      }

      const setCookieHeader = response.headers['set-cookie'];
      if (!setCookieHeader) {
        throw new Error('GeneXus no devolvió cookie de sesión');
      }

      const cookiesString = setCookieHeader
        .map((c: string) => c.split(';')[0])
        .join('; ');
      this.sessionCookies.set(sessionId, cookiesString);
      this.sessionEmpKeys.set(sessionId, response.data.EmpKey);

      this.logger.log(
        `[SessionHandler] Sesión establecida para dispositivo: ${sessionId} — EmpKey autoritativo: ${response.data.EmpKey}`,
      );
    } catch (err) {
      const axiosErr = err as {
        message: string;
        response?: { status: number; data: unknown };
      };
      this.logger.error(
        `[SessionHandler] Error al inicializar sesión para ${sessionId}: ${axiosErr.message}`,
      );
      if (axiosErr.response) {
        this.logger.error(
          `[SessionHandler] Respuesta GeneXus ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`,
        );
      }
      throw err;
    }
  }

  // ================================================================
  //  HTTP HELPERS
  // ================================================================

  private async executeGet<T>(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
    timeout: number,
  ): Promise<T> {
    const cleanParams: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null && value !== '') {
        cleanParams[key] = value as string | number | boolean;
      }
    }
    const { data } = await firstValueFrom(
      this.httpService.get<T>(url, { params: cleanParams, headers, timeout }),
    );
    return data;
  }

  private async executePost<T>(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
    timeout: number,
  ): Promise<T> {
    const { data } = await firstValueFrom(
      this.httpService.post<T>(url, payload, { headers, timeout }),
    );
    return data;
  }

  private async executePut<T>(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
    timeout: number,
  ): Promise<T> {
    const { data } = await firstValueFrom(
      this.httpService.put<T>(url, payload, { headers, timeout }),
    );
    return data;
  }

  /** DELETE con parámetros en query string (mismo formato que executeGet) — ej. EliminarLineaCarrito */
  private async executeDelete<T>(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
    timeout: number,
  ): Promise<T> {
    const cleanParams: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null && value !== '') {
        cleanParams[key] = value as string | number | boolean;
      }
    }
    const { data } = await firstValueFrom(
      this.httpService.delete<T>(url, {
        params: cleanParams,
        headers,
        timeout,
      }),
    );
    return data;
  }

  private async executeByMethod<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
    timeout: number,
  ): Promise<T> {
    switch (method) {
      case 'GET':
        return this.executeGet<T>(url, payload, headers, timeout);
      case 'PUT':
        return this.executePut<T>(url, payload, headers, timeout);
      case 'DELETE':
        return this.executeDelete<T>(url, payload, headers, timeout);
      case 'POST':
        return this.executePost<T>(url, payload, headers, timeout);
    }
  }

  private buildHeaders(
    cookie: string | undefined,
    extra?: Record<string, string>,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    };
  }

  // ================================================================
  //  REQUEST GENÉRICO
  // ================================================================

  async request<T>(
    endpoint: string,
    payload: Record<string, unknown>,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    options?: GxRequestOptions,
  ): Promise<T> {
    if (options?.target === 'pos') {
      if (!options.contexto) {
        throw new InternalServerErrorException(
          '[SessionHandler] Contexto de sesión requerido — el servicio debe pasar { target: "pos", contexto }',
        );
      }
      await this.ensureSessionInitialized(options.contexto);
    }

    const config = this.leerConfiguracion();
    const url = this.buildUrl(endpoint, options?.target);
    const sessionId = options?.contexto
      ? this.sessionKey(options.contexto)
      : undefined;
    const cookie = sessionId ? this.sessionCookies.get(sessionId) : undefined;
    const headers = this.buildHeaders(cookie, options?.headers);

    this.logger.debug(
      `[SessionHandler] GX ${method} → ${url} (dispositivo: ${sessionId ?? 'admin'}) cookie:${cookie ? cookie.substring(0, 60) + '…' : 'NONE'}`,
    );

    try {
      return await this.executeByMethod<T>(
        method,
        url,
        payload,
        headers,
        config.timeout,
      );
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      const responseData = (error as { response?: { data?: unknown } })
        ?.response?.data;

      this.logger.debug(
        `[SessionHandler] GX ${method} ${url} → HTTP ${status ?? '?'} body=${
          responseData === undefined ? '(none)' : JSON.stringify(responseData)
        }`,
      );

      // GeneXus reporta errores de NEGOCIO con HTTP 500 + body conteniendo el
      // SDT output del procedure (con su array `Messages`). Si el body trae esa
      // estructura, no es un error de sesión: devolvémoslo al servicio para que
      // su `throwIfErrors` muestre los Messages como errores controlados.
      // Excepción: 401/403 son siempre errores de sesión — el retry de más
      // abajo reinicializa la cookie aunque el body traiga Messages.
      const isAuthError = status === 401 || status === 403;
      if (!isAuthError && this.isGxBusinessErrorBody(responseData)) {
        const normalized = this.normalizeGxErrorBody(responseData);
        this.logger.debug(
          `[SessionHandler] GX ${method} ${url} → HTTP ${status} con Messages de negocio; devolviendo body al servicio`,
        );
        return normalized as T;
      }

      if (
        options?.contexto &&
        sessionId &&
        status !== undefined &&
        GenexusClientService.SESSION_ERROR_CODES.has(status)
      ) {
        this.logger.warn(
          `[SessionHandler] Error de sesión (${status}) — reintentando para dispositivo: ${sessionId}`,
        );
        this.sessionCookies.delete(sessionId);
        this.sessionEmpKeys.delete(sessionId);

        try {
          await this.initializeSession(options.contexto);
        } catch {
          this.logger.error(
            `[SessionHandler] No se pudo reinicializar la sesión para ${sessionId}`,
          );
          return this.classifyAndThrow(
            `[SessionHandler] Reintento fallido: no se pudo reinicializar sesión para ${sessionId}`,
          );
        }

        const newCookie = this.sessionCookies.get(sessionId);
        const retryHeaders = this.buildHeaders(newCookie, options?.headers);

        try {
          return await this.executeByMethod<T>(
            method,
            url,
            payload,
            retryHeaders,
            config.timeout,
          );
        } catch (retryError) {
          const retryMsg =
            retryError instanceof Error
              ? retryError.message
              : String(retryError);
          this.logger.error(
            `[SessionHandler] Reintento fallido para ${sessionId}: ${retryMsg}`,
          );
          return this.classifyAndThrow(retryMsg);
        }
      }

      const msg = error instanceof Error ? error.message : String(error);
      const responseBody =
        error != null &&
        typeof error === 'object' &&
        'response' in error &&
        (error as { response?: { data?: unknown } }).response?.data !==
          undefined
          ? JSON.stringify(
              (error as { response: { data: unknown } }).response.data,
            )
          : null;
      this.logger.error(
        `[SessionHandler] Error GeneXus [${method} ${url}]: ${msg}${responseBody ? ` — body: ${responseBody}` : ''}`,
      );
      return this.classifyAndThrow(msg);
    }
  }

  // ================================================================
  //  BLOB UPLOAD (gxobject) — paso previo a endpoints con campos BLOB
  // ================================================================

  /**
   * Sube un archivo binario al endpoint `<procedure>/gxobject` de GeneXus y
   * devuelve el `object_id` (ej. "xxxxx.tmp") que luego se pasa como valor del
   * campo BLOB en el endpoint de negocio (p.ej. FileBlobFile en
   * UploadPreciosNativo).
   *
   * En GeneXus (post 17 U3) el upload de blobs es POR PROCEDURE: se sube el
   * binario crudo (no multipart) con `Content-Type: application/octet-stream`
   * a la URL del procedure con sufijo `/gxobject`. Preserva la cookie de
   * sesión Tomcat del dispositivo igual que `request()`.
   *
   * @param procedureEndpoint endpoint del procedure destino (ej.
   *   `POS/AI_API/Precios/xListaDePrecios/UploadPreciosNativo`). El helper
   *   le agrega `/gxobject`.
   */
  async uploadBlob(
    contexto: IPosContext,
    procedureEndpoint: string,
    buffer: Buffer,
    fileName: string,
    contentType: string = 'application/octet-stream',
  ): Promise<string> {
    await this.ensureSessionInitialized(contexto);

    const sessionId = this.sessionKey(contexto);
    const cookie = this.sessionCookies.get(sessionId);
    const config = this.leerConfiguracion();
    const url = this.buildUrl(
      `${procedureEndpoint.replace(/\/+$/, '')}/gxobject`,
      'pos',
    );

    this.logger.debug(
      `[SessionHandler] GX UPLOAD-BLOB → ${url} (dispositivo: ${sessionId}) file:${fileName} size:${buffer.length}B cookie:${cookie ? cookie.substring(0, 60) + '…' : 'NONE'}`,
    );

    try {
      const { data } = await firstValueFrom(
        this.httpService.post<{ object_id?: string }>(url, buffer, {
          headers: {
            'Content-Type': contentType,
            Accept: 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
          },
          timeout: config.timeout,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }),
      );

      if (!data?.object_id) {
        this.logger.error(
          `[SessionHandler] gxobject no devolvió object_id — respuesta: ${JSON.stringify(data)}`,
        );
        throw new InternalServerErrorException(
          'GeneXus gxobject no devolvió object_id',
        );
      }

      this.logger.log(
        `[SessionHandler] gxobject OK — file:${fileName} object_id:${data.object_id}`,
      );
      return data.object_id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const responseBody =
        error != null &&
        typeof error === 'object' &&
        'response' in error &&
        (error as { response?: { data?: unknown } }).response?.data !==
          undefined
          ? JSON.stringify(
              (error as { response: { data: unknown } }).response.data,
            )
          : null;
      this.logger.error(
        `[SessionHandler] Error gxobject [POST ${url}] file:${fileName}: ${msg}${responseBody ? ` — body: ${responseBody}` : ''}`,
      );
      if (error instanceof InternalServerErrorException) throw error;
      return this.classifyAndThrow(msg);
    }
  }

  /**
   * Detecta si el body de una respuesta de error HTTP de GeneXus contiene
   * la estructura estándar de error de negocio. Soporta dos variantes:
   *   1. `{ Messages: GxMessage[] }` — contrato moderno.
   *   2. `{ Mensaje: "<MessageList>...</MessageList>" }` — variante usada por
   *      algunos procedures (p.ej. UploadPreciosNativo) donde GX devuelve
   *      HTTP 500 con un XML embebido como string.
   * En ambos casos el servicio debe procesar los mensajes vía `throwIfErrors`
   * en vez de reintentar como error de sesión.
   */
  private isGxBusinessErrorBody(data: unknown): boolean {
    if (data == null || typeof data !== 'object') return false;
    const obj = data as { Messages?: unknown; Mensaje?: unknown };
    if (Array.isArray(obj.Messages)) return true;
    if (
      typeof obj.Mensaje === 'string' &&
      obj.Mensaje.includes('<MessageList')
    ) {
      return true;
    }
    return false;
  }

  /**
   * Si el body usa la variante `{ Mensaje: "<MessageList>..." }`, parsea el
   * XML embebido y popula un array `Messages` compatible con `GxBaseResponse`
   * (Type=1 para errores, Id=Code, Description=Text). El body original se
   * conserva intacto; solo se agrega/reemplaza `Messages`.
   */
  private normalizeGxErrorBody(data: unknown): unknown {
    if (data == null || typeof data !== 'object') return data;
    const obj = data as { Messages?: unknown; Mensaje?: unknown };
    if (Array.isArray(obj.Messages) && obj.Messages.length > 0) return data;
    if (
      typeof obj.Mensaje !== 'string' ||
      !obj.Mensaje.includes('<MessageList')
    ) {
      return data;
    }

    const messages: { Id: string; Type: number; Description: string }[] = [];
    const itemRe = /<ListaItem>([\s\S]*?)<\/ListaItem>/g;
    const fieldRe = (tag: string) =>
      new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
    let match: RegExpExecArray | null;
    while ((match = itemRe.exec(obj.Mensaje)) !== null) {
      const block = match[1];
      const typeRaw = fieldRe('Type').exec(block)?.[1]?.trim() ?? '';
      const code = fieldRe('Code').exec(block)?.[1]?.trim() ?? '';
      const text = fieldRe('Text').exec(block)?.[1]?.trim() ?? '';
      // Type=1 → error, Type=2 → warning (convención GX). Default a error.
      const type = /warn/i.test(typeRaw) ? 2 : 1;
      messages.push({ Id: code, Type: type, Description: text });
    }
    return { ...obj, Messages: messages };
  }

  // ================================================================
  //  xVenta API — métodos directos
  // ================================================================

  /**
   * GET /rest/xInitVenta/GetEstadoCaja
   * Consulta el estado del turno de caja para la empresa indicada.
   */
  async getEstadoCaja<T = unknown>(empKey: number, token: string): Promise<T> {
    return this.request<T>(
      'POS/AI_API/Venta/xInitVenta/GetEstadoCaja',
      { Empkey: empKey, Token: token },
      'GET',
      { target: 'pos' },
    );
  }

  // ================================================================
  //  xCliente API — métodos directos
  // ================================================================

  /**
   * POST /rest/xCliente/GuardarCliente
   * Crea o actualiza un cliente. Las propiedades del payload se reenvían
   * dentro de SDTClienteEntrada con la primera letra capitalizada para
   * coincidir con el contrato GeneXus (ej: clienteRUT → ClienteRUT).
   */
  async guardarCliente<T = unknown>(
    empKey: number,
    token: string,
    payload: any,
  ): Promise<T> {
    const { clienteKeyIn, ...rest } = payload ?? {};
    const sdt: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (!key) continue;
      const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
      sdt[capitalized] = value;
    }

    return this.request<T>(
      'POS/AI_API/Venta/xCliente/GuardarCliente',
      {
        EmpKey: empKey,
        Token: token,
        ClienteKeyIn: clienteKeyIn || 0,
        SDTClienteEntrada: sdt,
      },
      'POST',
      { target: 'pos' },
    );
  }

  private classifyAndThrow(msg: string): never {
    if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/i.test(msg)) {
      throw new BadGatewayException(
        'Error de comunicacion con el servicio GeneXus',
      );
    }
    if (/timeout|ETIMEDOUT/i.test(msg)) {
      throw new GatewayTimeoutException(
        'Timeout al comunicarse con el servicio GeneXus',
      );
    }
    throw new InternalServerErrorException(
      'Error interno al comunicarse con GeneXus',
    );
  }
}
