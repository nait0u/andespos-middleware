import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';

@Injectable()
export class PocSessionService {
  private readonly logger = new Logger(PocSessionService.name);
  private sessionCookies = new Map<string, string>();

  constructor(
    private readonly httpService: HttpService,
    private readonly genexusClient: GenexusClientService,
  ) {}

  private getBaseUrl(): string {
    return 'http://192.168.56.18:8080/AndesPOS_API2602N/POS/AI_API/Sesion/SessionAPI';
  }

  private leerConfiguracion() {
    return this.genexusClient.leerConfiguracion();
  }

  private buildUrl(endpoint: string, target: 'pos' | 'admin' = 'pos'): string {
    if (target === 'pos') {
      const base = process.env.GX_POS_BASE_URL;
      if (!base) throw new Error('GX_POS_BASE_URL no está configurado en .env');
      return `${base.endsWith('/') ? base : base + '/'}${endpoint}`;
    }
    const config = this.genexusClient.leerConfiguracion();
    const protocol = config.secure ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}${config.baseUrl}${endpoint}`;
  }

  async requestConCookies(endpoint: string, payload: any, sessionId: string) {
    const url = `${this.getBaseUrl()}/${endpoint.replace(/^\//, '')}`;
    const savedCookie = this.sessionCookies.get(sessionId) ?? '';

    this.logger.log(`[PoC] >>> REQUEST [${sessionId}] → ${url}`);
    this.logger.log(`[PoC]     Cookie enviada : ${savedCookie || '(ninguna — primera llamada)'}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (savedCookie) {
      headers['Cookie'] = savedCookie;
    }

    const response = await firstValueFrom(
      this.httpService.post(url, payload, {
        headers,
        withCredentials: true,
      }),
    );

    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      const cookiesString = setCookieHeader.map((c: string) => c.split(';')[0]).join('; ');
      this.sessionCookies.set(sessionId, cookiesString);
      this.logger.log(`[PoC]     Set-Cookie recibida: ${setCookieHeader.join(' | ')}`);
      this.logger.log(`[PoC] *** COOKIE GUARDADA [${sessionId}]: ${cookiesString} ***`);
    }

    return response.data;
  }

  getCookies(sessionId: string): string {
    return this.sessionCookies.get(sessionId) ?? '';
  }

  // Extrae solo el valor del JSESSIONID para cruzar con Tomcat Manager
  getJSessionId(sessionId: string): string | null {
    const cookies = this.sessionCookies.get(sessionId) ?? '';
    const match = cookies.match(/JSESSIONID=([^;,\s]+)/);
    return match ? match[1] : null;
  }

  limpiarSesion(sessionId: string) {
    this.sessionCookies.delete(sessionId);
  }

  async inicializarContextoMock(sessionId: string, perfil: 'JAIME' | 'CONSTANZA' = 'JAIME'): Promise<string> {
    const config = this.leerConfiguracion();
    const urlInit = this.buildUrl('POS/AI_API/Sesion/SessionAPI/InicializarContexto', 'pos');

    const sdtJaime = {
      RutUsuario: "20613830", RutUsuarioDV: "206138300", Nombre: "Jaime Medalla Astete",
      Perfil: "CAJERAADMINISTRATIVA", PerfilDesc: "CAJERA ADMINISTRATIVA", Mandante: "76407930",
      RutEmpresa: "500000023", Sucursal: "Local1", PuntoAccesoKey: 2,
      EstacionIdl: "CAJA1", ModoConexion: "Remoto", ModuloAplicacionIdl: "CAJA"
    };

    const sdtConstanza = {
      RutUsuario: "18373061", RutUsuarioDV: "183730614", Nombre: "CONSTANZA PALOMO MIRANDA",
      Perfil: "posadmcert", PerfilDesc: "POS Administrador Certificador", Mandante: "76407930",
      RutEmpresa: "500000023", Sucursal: "", PuntoAccesoKey: 0,
      EstacionIdl: "", ModoConexion: "Remoto", ModuloAplicacionIdl: "XXXXXX"
    };

    const payload = {
      SDTIniSessionTest: perfil === 'CONSTANZA' ? sdtConstanza : sdtJaime
    };

    try {
      this.logger.log(`[BFF] Inicializando contexto MOCK [${perfil}] para sesión: ${sessionId}`);
      this.logger.debug(`[BFF] POST → ${urlInit}`);
      this.logger.debug(`[BFF] Payload: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService.post(urlInit, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: config.timeout,
          withCredentials: true,
        })
      );

      const setCookieHeader = response.headers['set-cookie'];
      if (!setCookieHeader) throw new Error('GeneXus no devolvió el JSESSIONID.');

      const cookiesString = setCookieHeader.map((c: string) => c.split(';')[0]).join('; ');
      this.sessionCookies.set(sessionId, cookiesString);

      this.logger.log(`[BFF] Sesión MOCK [${perfil}] inicializada exitosamente. Cookie: ${cookiesString.substring(0, 30)}...`);
      return cookiesString;

    } catch (err) {
      const axiosErr = err as { message: string; response?: { status: number; data: unknown } };
      this.logger.error(`Fallo al sincronizar estado con Tomcat: ${axiosErr.message}`);
      if (axiosErr.response) {
        this.logger.error(`[BFF] Respuesta GeneXus ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`);
      }
      throw err;
    }
  }
}
