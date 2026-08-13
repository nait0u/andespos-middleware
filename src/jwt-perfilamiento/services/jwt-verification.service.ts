import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeJwt, errors, jwtVerify, type JWTPayload } from 'jose';
import { PublicKeyLoaderService, ClavePublicaInvalidaError } from './public-key-loader.service.js';
import { DEFAULT_CLOCK_GRACE_SECONDS, ENV_CLOCK_GRACE_SECONDS } from '../constants.js';

export type ResultadoVerificacion =
  | { ok: true; payload: JWTPayload }
  | { ok: false; tipo: 'token_malformado' | 'alg_invalido' | 'firma_invalida' | 'clave_publica_invalida' }
  | { ok: false; tipo: 'periodo_invalido'; reentryUrl: string | null };

export interface OpcionesVerificar {
  /** Reloj inyectable para tests. Default: new Date() (reloj real del sistema). */
  ahora?: Date;
}

/**
 * Verifica la firma RS256 de un JWT de Perfilamiento (doc §4, pasos 2-5, 8).
 *
 * Usa `jose` en vez de decodificar-luego-chequear-alg-luego-verificar en pasos
 * manuales separados (como sugiere literalmente el doc): `jose` pinea el
 * algoritmo dentro de la misma llamada de verificación (`algorithms: ['RS256']`),
 * cerrando la puerta a ataques de confusión de algoritmo sin depender de un
 * paso previo que se pueda omitir por error.
 *
 * `iat` no se usa para nada acá — es inservible en producción (offset UTC-4
 * estampado como UTC) — solo `nbf`/`exp` participan en la validación de vigencia,
 * con tolerancia simétrica configurable (`clockTolerance`).
 */
@Injectable()
export class JwtVerificationService {
  private readonly logger = new Logger(JwtVerificationService.name);

  constructor(
    private readonly publicKeyLoader: PublicKeyLoaderService,
    private readonly configService: ConfigService,
  ) {}

  async verificar(jwt: string, opciones: OpcionesVerificar = {}): Promise<ResultadoVerificacion> {
    const toleranciaSegundos =
      this.configService.get<number>(ENV_CLOCK_GRACE_SECONDS) ?? DEFAULT_CLOCK_GRACE_SECONDS;
    this.logger.debug(`verificar: toleranciaSegundos=${toleranciaSegundos}`);

    let key;
    try {
      key = await this.publicKeyLoader.getPublicKey();
      this.logger.debug('verificar: clave pública obtenida OK (cache o fetch)');
    } catch (error) {
      if (error instanceof ClavePublicaInvalidaError) {
        this.logger.error(`verificar: clave pública inválida — ${error.message}`);
        return { ok: false, tipo: 'clave_publica_invalida' };
      }
      throw error;
    }

    try {
      const { payload } = await jwtVerify(jwt, key, {
        algorithms: ['RS256'],
        clockTolerance: toleranciaSegundos,
        ...(opciones.ahora ? { currentDate: opciones.ahora } : {}),
      });
      this.logger.log(`verificar: firma+vigencia OK — jti:${payload['jti']} nbf:${payload['nbf']} exp:${payload['exp']}`);
      this.logger.debug(`verificar: payload crudo completo → ${JSON.stringify(payload, null, 2)}`);
      return { ok: true, payload };
    } catch (error) {
      const resultado = this.mapearError(error, jwt);
      const code = (error as { code?: string }).code ?? '(sin código)';
      this.logger.warn(`verificar: rechazado — tipo:${resultado.tipo} code:${code} mensaje:${(error as Error).message}`);
      return resultado;
    }
  }

  private mapearError(error: unknown, jwt: string): Exclude<ResultadoVerificacion, { ok: true }> {
    const code = (error as { code?: string }).code;

    if (
      code === 'ERR_JWT_EXPIRED' ||
      (error instanceof errors.JWTClaimValidationFailed && (error as { claim?: string }).claim === 'nbf')
    ) {
      return { ok: false, tipo: 'periodo_invalido', reentryUrl: this.extraerReentryUrl(jwt) };
    }
    if (code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      return { ok: false, tipo: 'firma_invalida' };
    }
    if (code === 'ERR_JOSE_ALG_NOT_ALLOWED' || code === 'ERR_JOSE_NOT_SUPPORTED') {
      return { ok: false, tipo: 'alg_invalido' };
    }
    return { ok: false, tipo: 'token_malformado' };
  }

  /** Decodifica sin verificar solo para recuperar ReentryURL en un token expirado. */
  private extraerReentryUrl(jwt: string): string | null {
    try {
      const crudo = decodeJwt(jwt);
      const reentry = (crudo as Record<string, unknown>)['ReentryURL'];
      return typeof reentry === 'string' ? reentry : null;
    } catch {
      return null;
    }
  }
}
