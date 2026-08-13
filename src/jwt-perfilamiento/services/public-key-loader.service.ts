import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { readFile } from 'node:fs/promises';
import { importSPKI } from 'jose';
import {
  ENV_PUBLIC_KEY_PATH,
  ENV_PUBLIC_KEY_URL,
  PUBLIC_KEY_CACHE_TTL_MS,
} from '../constants.js';

/** La clave pública configurada no es un PEM válido/importable para RS256. */
export class ClavePublicaInvalidaError extends Error {}

interface CacheEntry {
  key: CryptoKey;
  fetchedAt: number;
}

/**
 * Resuelve y cachea en memoria la clave pública RS256 de Perfilamiento (doc §6).
 * Fuente: `JWT_PERFILAMIENTO_PUBLIC_KEY_URL` (remota, TTL 1h) con fallback a
 * `JWT_PERFILAMIENTO_PUBLIC_KEY_PATH` (archivo local PEM). Sin dependencia de
 * ningún otro paquete @andestec — resolución 100% por env vars propias.
 */
@Injectable()
export class PublicKeyLoaderService {
  private readonly logger = new Logger(PublicKeyLoaderService.name);
  private cache: CacheEntry | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getPublicKey(): Promise<CryptoKey> {
    const ahora = Date.now();
    if (this.cache && ahora - this.cache.fetchedAt < PUBLIC_KEY_CACHE_TTL_MS) {
      this.logger.debug(`getPublicKey: usando cache en memoria (edad ${Math.round((ahora - this.cache.fetchedAt) / 1000)}s)`);
      return this.cache.key;
    }

    this.logger.debug('getPublicKey: cache vencida/ausente — resolviendo PEM');
    const pem = await this.leerPem();
    let key: CryptoKey;
    try {
      key = await importSPKI(pem, 'RS256');
      this.logger.log('getPublicKey: PEM importado como clave RS256 OK');
    } catch (error) {
      this.logger.error(`getPublicKey: el PEM obtenido no es una clave RS256 válida — ${(error as Error).message}`);
      throw new ClavePublicaInvalidaError('La clave pública configurada no es un PEM RS256 válido');
    }

    this.cache = { key, fetchedAt: ahora };
    return key;
  }

  private async leerPem(): Promise<string> {
    const url = this.configService.get<string>(ENV_PUBLIC_KEY_URL);
    if (url) {
      this.logger.log(`leerPem: descargando clave pública desde ${url}`);
      try {
        const response = await firstValueFrom(this.httpService.get<string>(url));
        this.logger.debug(`leerPem: descarga OK (${String(response.data).length} bytes)`);
        return String(response.data);
      } catch (error) {
        this.logger.warn(`leerPem: no se pudo descargar desde ${url}: ${(error as Error).message} — probando fallback a archivo`);
      }
    }

    const path = this.configService.get<string>(ENV_PUBLIC_KEY_PATH);
    if (path) {
      this.logger.log(`leerPem: leyendo clave pública desde archivo ${path}`);
      return readFile(path, 'utf-8');
    }

    this.logger.error(`leerPem: ninguna fuente configurada (${ENV_PUBLIC_KEY_URL} / ${ENV_PUBLIC_KEY_PATH})`);
    throw new ClavePublicaInvalidaError(
      `Ninguna fuente de clave pública configurada (${ENV_PUBLIC_KEY_URL} / ${ENV_PUBLIC_KEY_PATH})`,
    );
  }
}
