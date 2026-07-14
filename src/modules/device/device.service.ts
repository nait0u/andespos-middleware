import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createDecipheriv, createHmac, createHash } from 'crypto';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import type {
  SDTDispositivoInformacion,
  TokenValidationResult,
  DeviceClaveResponse,
  DeviceInformacionResponse,
} from '../../common/interfaces/device.interfaces.js';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  // ── Constantes fieles al codigo JS original ──────────────────────
  private static readonly ENCRYPTION_KEY = 'Qf1qLSDrqSRLYmjo';
  private static readonly HMAC_KEY = '123';
  private static readonly TOKEN_VERSION = 'M2406';
  private static readonly PAIRING_KEY = 'ClavePareoDisp2024';
  private static readonly VALID_TOKEN_PREFIXES = 'MSPI';
  private static readonly TOKEN_TOLERANCE_SECONDS = 7200; // 2 horas
  private static readonly TTL_MS = 5 * 60 * 1000; // 5 minutos
  private static readonly ALLOWED_TOKEN_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.,;+-*/_?!@#$%&()<>"\'';

  constructor(
    @Inject(forwardRef(() => GenexusClientService))
    private readonly genexusClient: GenexusClientService,
  ) {}

  // ================================================================
  //  PATH MANAGEMENT  (replica GetPathRaiz / GetPathDispositivo)
  // ================================================================

  getPathRaiz(): string {
    if (process.platform === 'win32') {
      return 'C:\\Program Files\\Apache Software Foundation\\Tomcat 8.5\\webapps';
    }
    return '/opt/Dispositivo';
  }

  getPathDispositivo(): string {
    return join(this.getPathRaiz(), 'DATA', 'Dispositivo24');
  }

  getPathPersistenciaDispositivo(): string {
    return join(this.getPathDispositivo(), 'Persistencia2411', 'Dispositivos');
  }

  // ================================================================
  //  CRIPTOGRAFIA LEGACY  (AES-128-CBC con ZeroBytePadding)
  // ================================================================

  /**
   * Replica exacta de `desencriptar()` de UtilesDispositivo.js.
   * AES-128-CBC con IV embebido en los primeros 16 bytes del payload Base64.
   * setAutoPadding(false) para simular ZeroBytePadding de BouncyCastle.
   */
  desencriptar(textoEncriptado: string, clave: string): string | null {
    try {
      const bytesEnc = Buffer.from(textoEncriptado, 'base64');
      const iv = bytesEnc.subarray(0, 16);
      const contenidoEncriptado = bytesEnc.subarray(16);

      const decipher = createDecipheriv(
        'aes-128-cbc',
        Buffer.from(clave, 'utf-8'),
        iv,
      );
      decipher.setAutoPadding(false);

      let desencriptado = Buffer.concat([
        decipher.update(contenidoEncriptado),
        decipher.final(),
      ]);

      // Eliminar bytes de padding cero al final (ZeroBytePadding)
      let len = desencriptado.length;
      while (len > 0 && desencriptado[len - 1] === 0) {
        len--;
      }
      desencriptado = desencriptado.subarray(0, len);

      return desencriptado.toString('utf-8');
    } catch (error) {
      this.logger.error(`Error al desencriptar: ${(error as Error).message}`);
      return null;
    }
  }

  /** HMAC-SHA512 con clave '123', hex UPPERCASE (fiel al JS original) */
  private generateHmacHash(tag: string): string {
    return createHmac('sha512', DeviceService.HMAC_KEY)
      .update(tag)
      .digest('hex')
      .toUpperCase();
  }

  /** MD5 hex UPPERCASE (replica GetMD5CodeHex de UtilesToken.js) */
  private getMD5CodeHex(str: string): string {
    return createHash('md5').update(str, 'utf-8').digest('hex').toUpperCase();
  }

  // ================================================================
  //  LECTURA DISPOSITIVO  (DispInfo.txt)
  // ================================================================

  /** Linea 1 de DispInfo.txt → DispositivoId desencriptado */
  getDispositivoId(): string | null {
    const rutaArchivo = join(this.getPathDispositivo(), 'DispInfo.txt');
    try {
      const contenido = readFileSync(rutaArchivo, 'utf-8');
      const contenidoEncriptado = contenido.split('\n')[0].trim();
      return this.desencriptar(
        contenidoEncriptado,
        DeviceService.ENCRYPTION_KEY,
      );
    } catch (error) {
      this.logger.error(
        `Error al leer DispInfo.txt: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /** Linea 2 de DispInfo.txt → DispositivoClave desencriptada */
  getDispositivoClave(): string | null {
    const rutaArchivo = join(this.getPathDispositivo(), 'DispInfo.txt');
    try {
      const contenido = readFileSync(rutaArchivo, 'utf-8');
      const lineas = contenido.split('\n');

      if (lineas.length < 2) {
        this.logger.error('DispInfo.txt no tiene suficientes lineas');
        return null;
      }

      const contenidoEncriptado = lineas[1].trim();
      return this.desencriptar(
        contenidoEncriptado,
        DeviceService.ENCRYPTION_KEY,
      );
    } catch (error) {
      this.logger.error(
        `Error al leer DispInfo.txt: ${(error as Error).message}`,
      );
      return null;
    }
  }

  // ================================================================
  //  PERSISTENCIA  (HMAC-SHA512 + 3 niveles de subdirectorios)
  // ================================================================

  /**
   * Construye la ruta de persistencia a partir del tag.
   * Algoritmo: HMAC-SHA512(tag, '123') → hex UPPER
   *   dir1 = hash[0:2].lower, dir2 = hash[2:4].lower, dir3 = hash[4:6].lower
   *   archivo = {tag}-{hash[6:]}.xml
   */
  private buildPersistencePath(tag: string): {
    rutaDirectorio: string;
    rutaArchivo: string;
  } {
    const hashTexto = this.generateHmacHash(tag);
    const pathPersistencia = this.getPathPersistenciaDispositivo();

    const dir1 = hashTexto.substring(0, 2).toLowerCase();
    const dir2 = hashTexto.substring(2, 4).toLowerCase();
    const dir3 = hashTexto.substring(4, 6).toLowerCase();
    const hashRestante = hashTexto.substring(6);

    const nombreArchivo = `${tag}-${hashRestante}.xml`;
    const rutaDirectorio = join(pathPersistencia, dir1, dir2, dir3);
    const rutaArchivo = join(rutaDirectorio, nombreArchivo);

    return { rutaDirectorio, rutaArchivo };
  }

  /** Replica PersistenciaSetDispositivo de UtilesDispositivo.js */
  persistenciaSetDispositivo(tag: string, valor: string): boolean {
    try {
      const { rutaDirectorio, rutaArchivo } = this.buildPersistencePath(tag);
      mkdirSync(rutaDirectorio, { recursive: true });
      writeFileSync(rutaArchivo, valor, 'utf-8');
      this.logger.log(`Persistencia guardada en: ${rutaArchivo}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error al guardar persistencia: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /** Replica PersistenciaGetDispositivo de UtilesDispositivo.js */
  persistenciaGetDispositivo(tag: string): string | null {
    try {
      const { rutaArchivo } = this.buildPersistencePath(tag);
      return readFileSync(rutaArchivo, 'utf-8');
    } catch {
      return null;
    }
  }

  // ================================================================
  //  TOKEN  (MD5, replica TokenGen / TokenStripString / TokenVal)
  // ================================================================

  /** Timestamp en formato XML: YYYY-MM-DDTHH:mm:ss (19 caracteres) */
  getTimestampXML(): string {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  }

  /**
   * Replica TokenStripString: conserva solo caracteres alfanumericos
   * y un set fijo de simbolos. Preserva case original.
   */
  tokenStripString(stringIn: string): string {
    let stringOut = '';
    for (let i = 0; i < stringIn.length; i++) {
      const cha = stringIn[i];
      const chaUpp = cha.toUpperCase();
      if (DeviceService.ALLOWED_TOKEN_CHARS.includes(chaUpp)) {
        stringOut += cha;
      }
    }
    return stringOut;
  }

  /**
   * Genera token de seguridad.
   * Estructura: Version(5) + DispositivoIdPadded(30) + TimestampXML(19) + MD5Hash
   */
  tokenGen(strControl: string): string | null {
    try {
      const dispositivoId = this.getDispositivoId();
      const password = this.getDispositivoClave();

      if (!dispositivoId || !password) {
        this.logger.error('No se pudo obtener DispositivoId o Clave');
        return null;
      }

      const timestampXML = this.getTimestampXML();

      let hash =
        password.trim() +
        dispositivoId.trim() +
        strControl.trim() +
        timestampXML.trim() +
        password.trim();
      hash = this.tokenStripString(hash);

      this.logger.debug(`Hash generado: ${hash}`);

      const md5Hash = this.getMD5CodeHex(hash);
      const dispositivoIdPadded = dispositivoId.padStart(30, ' ');

      return (
        DeviceService.TOKEN_VERSION +
        dispositivoIdPadded +
        timestampXML +
        md5Hash
      );
    } catch (error) {
      this.logger.error(
        `Error al generar token: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Valida un token entrante.
   * Soporta versiones M2406 (dispositivo movil) e I2406 (pareo/inicio).
   * Tolerancia de tiempo: 2 horas.
   */
  async tokenVal(
    token: string,
    strControl: string,
  ): Promise<TokenValidationResult> {
    const resultado: TokenValidationResult = {
      valido: false,
      mensaje: '',
      dispositivoId: '',
    };

    if (!token) {
      resultado.mensaje = 'Error de autenticacion, Token Invalido';
      return resultado;
    }

    const primerCaracter = token.substring(0, 1);
    if (!DeviceService.VALID_TOKEN_PREFIXES.includes(primerCaracter)) {
      resultado.mensaje = 'Token con formato incorrecto';
      return resultado;
    }

    // Extraer componentes: [Version 5][DispositivoId 30][Timestamp 19][Hash resto]
    const versionToken = token.substring(0, 5).trim();
    const dispositivoId = token.substring(5, 35).trim();
    const timestampXML = token.substring(35, 54).trim();

    // Parsear timestamp (YYYY-MM-DDTHH:mm:ss)
    const year = parseInt(timestampXML.substring(0, 4), 10);
    const month = parseInt(timestampXML.substring(5, 7), 10) - 1;
    const day = parseInt(timestampXML.substring(8, 10), 10);
    const hours = parseInt(timestampXML.substring(11, 13), 10);
    const minutes = parseInt(timestampXML.substring(14, 16), 10);
    const seconds = parseInt(timestampXML.substring(17, 19), 10);
    const timestamp = new Date(year, month, day, hours, minutes, seconds);

    const diferenciaSegundos = Math.abs(
      (Date.now() - timestamp.getTime()) / 1000,
    );
    if (diferenciaSegundos > DeviceService.TOKEN_TOLERANCE_SECONDS) {
      resultado.mensaje = 'Error de tolerancia de tiempo, Token caduco';
      return resultado;
    }

    let password: string | null = '';

    switch (versionToken) {
      case 'M2406': {
        password = await this.getDispositivoClaveRemoto(dispositivoId);
        if (!password) {
          resultado.mensaje = 'Error al obtener la clave del dispositivo';
          return resultado;
        }
        break;
      }
      case 'I2406': {
        password = DeviceService.PAIRING_KEY;
        break;
      }
      default:
        resultado.mensaje = `Version de token no soportada: ${versionToken}`;
        return resultado;
    }

    // Reconstruir token localmente y comparar (case insensitive)
    const strControlAux =
      password.trim() +
      dispositivoId.trim() +
      strControl.trim() +
      timestampXML.trim() +
      password.trim();
    const strAux = this.tokenStripString(strControlAux);
    const dispositivoIdPadded = dispositivoId.padStart(30, ' ');
    const tokenLocal =
      versionToken +
      dispositivoIdPadded +
      timestampXML +
      this.getMD5CodeHex(strAux);

    if (token.toUpperCase() !== tokenLocal.toUpperCase()) {
      resultado.mensaje = 'Error de autenticacion, Token Invalido';
      return resultado;
    }

    resultado.valido = true;
    resultado.dispositivoId = dispositivoId;
    return resultado;
  }

  // ================================================================
  //  OPERACIONES REMOTAS  (delegadas a GenexusClientService)
  //
  //  REGLA DE RETROCOMPATIBILIDAD: Los endpoints, query-params y
  //  payloads que llegan a GeneXus son EXACTAMENTE iguales a los del
  //  código original. Solo cambia quién emite el HttpRequest.
  // ================================================================

  /**
   * Obtiene la clave del dispositivo: primero intenta persistencia local,
   * si no existe llama al servicio GeneXus APIDispositivos/GetDispositivoClave.
   * Endpoint GeneXus: APIDispositivos/GetDispositivoClave
   * Params GeneXus:   DispositivoId, Empkey (= 0)
   */
  async getDispositivoClaveRemoto(
    dispositivoId: string,
  ): Promise<string | null> {
    try {
      const tag = `Clave${dispositivoId}`;
      const clavePersistida = this.persistenciaGetDispositivo(tag);

      if (clavePersistida) {
        this.logger.log('Clave encontrada en persistencia');
        return clavePersistida.trim();
      }

      this.logger.log('Clave no encontrada, consultando servicio remoto...');

      const data = await this.genexusClient.request<DeviceClaveResponse>(
        'APIDispositivos/GetDispositivoClave',
        { DispositivoId: dispositivoId, Empkey: 0 },
        'GET',
      );

      this.logger.debug(`[GetDispositivoClave] Respuesta raw: ${JSON.stringify(data)}`);
      const clave = data.DispositivoClave || data.Password || data.password;
      if (!clave) {
        this.logger.error('No se pudo extraer la clave de la respuesta');
        return null;
      }

      this.persistenciaSetDispositivo(tag, clave);
      return clave.trim();
    } catch (error) {
      this.logger.error(
        `Error al obtener clave remota: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Consume APIPareo/GetDispositivoInformacion.
   * Endpoint GeneXus: APIPareo/GetDispositivoInformacion
   * Params GeneXus:   DispositivoId, Token
   */
  async consumoGetDispositivoInformacion(): Promise<DeviceInformacionResponse | null> {
    try {
      const dispositivoId = this.getDispositivoId();
      if (!dispositivoId) {
        throw new Error('DispositivoId no disponible');
      }

      const token = this.tokenGen(dispositivoId);
      if (!token) {
        throw new Error('No se pudo generar el token');
      }

      const data = await this.genexusClient.request<DeviceInformacionResponse>(
        'APIPareo/GetDispositivoInformacion',
        { DispositivoId: dispositivoId, Token: token },
        'GET',
      );

      // Persistir si trae informacion (replica ConsumoGetDispositivoInformacion.js)
      if (data?.DispositivoInformacion) {
        const dispositivoInfo: SDTDispositivoInformacion = JSON.parse(
          data.DispositivoInformacion,
        );
        const tag = `Informacion${dispositivoId}`;
        this.persistenciaSetDispositivo(tag, JSON.stringify(dispositivoInfo));
      }

      return data;
    } catch (error) {
      this.logger.error(
        `Error al obtener informacion del dispositivo: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Lee informacion del dispositivo con cache TTL de 5 minutos.
   * Si el archivo de persistencia existe y es reciente, lo retorna.
   * Si no, consume el servicio remoto y refresca la persistencia.
   */
  async leerArchivoDispositivoInformacion(): Promise<SDTDispositivoInformacion | null> {
    try {
      const dispositivoId = this.getDispositivoId();
      if (!dispositivoId) {
        throw new Error('No se pudo obtener el DispositivoId');
      }

      const tag = `Informacion${dispositivoId}`;
      const { rutaArchivo } = this.buildPersistencePath(tag);

      try {
        const stats = statSync(rutaArchivo);
        const diferenciaMs = Date.now() - stats.mtime.getTime();

        if (diferenciaMs < DeviceService.TTL_MS) {
          this.logger.log(
            `Informacion vigente (${Math.floor(diferenciaMs / 1000)}s)`,
          );
          const contenido = readFileSync(rutaArchivo, 'utf-8');
          return JSON.parse(contenido) as SDTDispositivoInformacion;
        }

        this.logger.log('Informacion vencida (> 5 min), refrescando...');
      } catch {
        this.logger.log(
          'Archivo de persistencia no encontrado, consultando servicio...',
        );
      }

      const respuesta = await this.consumoGetDispositivoInformacion();

      if (!respuesta?.DispositivoInformacion) {
        throw new Error('No se recibio informacion valida del servicio');
      }

      const dispositivoInfo: SDTDispositivoInformacion = JSON.parse(
        respuesta.DispositivoInformacion,
      );
      this.persistenciaSetDispositivo(tag, JSON.stringify(dispositivoInfo));

      return dispositivoInfo;
    } catch (error) {
      this.logger.error(
        `Error al leer informacion del dispositivo: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /** Obtiene el AmbienteId del dispositivo actual */
  async getDispositivoAmbiente(): Promise<string | null> {
    const info = await this.leerArchivoDispositivoInformacion();
    if (!info?.AmbienteId) {
      this.logger.error(
        'AmbienteId no encontrado en informacion del dispositivo',
      );
      return null;
    }
    return info.AmbienteId.trim();
  }
}
