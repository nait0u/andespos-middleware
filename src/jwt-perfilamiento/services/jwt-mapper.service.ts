import { Injectable, Logger } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import type { AuthzJWT } from '../interfaces/authz-jwt.interface.js';
import type { JWTAudience } from '../interfaces/jwt-audience.interface.js';
import type { JWTRol } from '../interfaces/jwt-rol.interface.js';
import { ISSUER_NOMBRE_ESPERADO } from '../constants.js';

export type ResultadoMapeo = { ok: true; authzJwt: AuthzJWT } | { ok: false; tipo: 'iss_invalido' | 'estructura_invalida' };

/**
 * Los claims compuestos de Perfilamiento (`iss`, `aud`, `Rol`) pueden viajar
 * como objeto JSON anidado o como JSON serializado en un string (`.ToJson()`
 * del lado GeneXus) — doc §3.2. Se intenta parsear cuando llega como string;
 * si no es JSON válido, el claim queda `undefined` en vez de romper el mapeo.
 */
function objetoDeClaim(valor: unknown): Record<string, unknown> | undefined {
  if (typeof valor === 'string') {
    try {
      const parsed: unknown = JSON.parse(valor);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof valor === 'object' && valor !== null) {
    return valor as Record<string, unknown>;
  }
  return undefined;
}

function aISO(segundosUnix: unknown): string {
  return typeof segundosUnix === 'number' ? new Date(segundosUnix * 1000).toISOString() : '';
}

/** Extrae el sufijo numérico ":<n>" de un jti tipo "uuid-...:1234", si existe. */
function asignacionDesdeJti(jti: string): number | null {
  const idx = jti.lastIndexOf(':');
  if (idx === -1) return null;
  const sufijo = jti.slice(idx + 1);
  const valor = Number(sufijo);
  return Number.isInteger(valor) ? valor : null;
}

/**
 * Mapea el payload crudo (ya verificado) del JWT a `AuthzJWT` (doc §4 paso 6-7).
 * `iat` se conserva solo como ISO para exposición vía getters — no participa
 * de ninguna decisión (ver `jwt-verification.service.ts`).
 */
@Injectable()
export class JwtMapperService {
  private readonly logger = new Logger(JwtMapperService.name);

  mapear(payload: JWTPayload, jwtCrudo: string): ResultadoMapeo {
    const { iss, aud, Rol, jti, iat, nbf, exp } = payload as Record<string, unknown>;
    this.logger.debug(
      `mapear: claims crudos — iss:${typeof iss} aud:${typeof aud} Rol:${typeof Rol} jti:${typeof jti} iat:${typeof iat} nbf:${typeof nbf} exp:${typeof exp}`,
    );

    if (typeof jti !== 'string' || typeof iat !== 'number' || typeof nbf !== 'number' || typeof exp !== 'number') {
      this.logger.warn('mapear: estructura_invalida — falta jti(string) o iat/nbf/exp(number)');
      return { ok: false, tipo: 'estructura_invalida' };
    }

    const issObj = objetoDeClaim(iss);
    if (issObj?.['Nombre'] !== ISSUER_NOMBRE_ESPERADO) {
      this.logger.warn(
        `mapear: iss_invalido — esperado Nombre="${ISSUER_NOMBRE_ESPERADO}", recibido:${JSON.stringify(issObj)} (crudo: ${JSON.stringify(iss)})`,
      );
      return { ok: false, tipo: 'iss_invalido' };
    }

    const audObj = objetoDeClaim(aud);
    const rolObj = objetoDeClaim(Rol);
    if (!audObj || !rolObj) {
      this.logger.warn(
        `mapear: estructura_invalida — aud parseable:${!!audObj} Rol parseable:${!!rolObj}. aud crudo:${JSON.stringify(aud)} Rol crudo:${JSON.stringify(Rol)}`,
      );
      return { ok: false, tipo: 'estructura_invalida' };
    }

    this.logger.debug(`mapear: aud parseado (objeto) → ${JSON.stringify(audObj, null, 2)}`);
    this.logger.debug(`mapear: Rol parseado (objeto) → ${JSON.stringify(rolObj, null, 2)}`);

    const audienceMapeado: JWTAudience = {
      AgenteKey: typeof audObj['AgenteKey'] === 'number' ? (audObj['AgenteKey'] as number) : 0,
      AgenteName: typeof audObj['AgenteName'] === 'string' ? (audObj['AgenteName'] as string) : '',
      AgenteLastName: typeof audObj['AgenteLastName'] === 'string' ? (audObj['AgenteLastName'] as string) : '',
      PI: Array.isArray(audObj['PI']) ? (audObj['PI'] as JWTAudience['PI']) : [],
      Canal: Array.isArray(audObj['Canal']) ? (audObj['Canal'] as JWTAudience['Canal']) : [],
    };

    const rolMapeado: JWTRol = {
      RolName: typeof rolObj['RolName'] === 'string' ? (rolObj['RolName'] as string) : '',
      RolKey: typeof rolObj['RolKey'] === 'number' ? (rolObj['RolKey'] as number) : 0,
      PerfilIdL: typeof rolObj['PerfilIdL'] === 'string' ? (rolObj['PerfilIdL'] as string) : '',
      PerfilName: typeof rolObj['PerfilName'] === 'string' ? (rolObj['PerfilName'] as string) : '',
      PerfilDescripcion: typeof rolObj['PerfilDescripcion'] === 'string' ? (rolObj['PerfilDescripcion'] as string) : '',
      Alcance: Array.isArray(rolObj['Alcance']) ? (rolObj['Alcance'] as JWTRol['Alcance']) : [],
      Atribucion: Array.isArray(rolObj['Atribucion']) ? (rolObj['Atribucion'] as JWTRol['Atribucion']) : [],
    };

    const asignacionClaim = typeof payload['Asignacion'] === 'number' ? (payload['Asignacion'] as number) : null;
    const reentryUrl = typeof payload['ReentryURL'] === 'string' ? (payload['ReentryURL'] as string) : null;

    const authzJwt: AuthzJWT = {
      issuerNombre: String(issObj['Nombre']),
      aud: audienceMapeado,
      rol: rolMapeado,
      jti,
      asignacion: asignacionClaim ?? asignacionDesdeJti(jti),
      iatISO: aISO(iat),
      nbfISO: aISO(nbf),
      expISO: aISO(exp),
      reentryUrl,
      jwt: jwtCrudo,
    };

    this.logger.log(
      `mapear: OK — AgenteKey:${audienceMapeado.AgenteKey} PI:${audienceMapeado.PI.length} PerfilIdL:"${rolMapeado.PerfilIdL}" Alcance:${rolMapeado.Alcance.length} Atribucion:${rolMapeado.Atribucion.length}`,
    );
    return { ok: true, authzJwt };
  }
}
