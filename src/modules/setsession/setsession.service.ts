import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PersistenciaService } from '@andestec/persistencia-redis/nestjs';
import { SessionVariablesService, type SessionVariables, type ErrorTipo } from '../../jwt-perfilamiento/index.js';
import { REPOSITORIO_SESIONES_PERFILAMIENTO } from '../../common/constants/session-store.constants.js';
import type { SesionPerfilamientoPersistida } from '../../common/interfaces/sesion-perfilamiento.interface.js';

export type ResultadoSetsession =
  | { validatedOK: true; periodOK: true; sessionId: string; sessionVariables: SessionVariables; expISO: string }
  | { validatedOK: true; periodOK: false; reentryUrl: string | null }
  | { validatedOK: false; periodOK: false; errorTipo: ErrorTipo };

/**
 * Orquesta la validación del JWT de Perfilamiento (paquete `jwt-perfilamiento`)
 * y la persistencia de la sesión resultante en Redis (`@andestec/persistencia-redis`,
 * ya disponible en la app de forma transitiva vía `DispositivoModule`/`ParametrosModule`).
 */
@Injectable()
export class SetsessionService {
  private readonly logger = new Logger(SetsessionService.name);

  constructor(
    private readonly sessionVariablesService: SessionVariablesService,
    private readonly persistenciaService: PersistenciaService,
  ) {}

  async validarYCrearSesion(jwt: string, parametro?: string): Promise<ResultadoSetsession> {
    this.logger.debug(`validarYCrearSesion: delegando a SessionVariablesService.validar() (parametro="${parametro ?? ''}")`);
    const resultado = await this.sessionVariablesService.validar(jwt, parametro);

    if (!resultado.validatedOK || !resultado.periodOK) {
      this.logger.debug(`validarYCrearSesion: no se crea sesión (validatedOK:${resultado.validatedOK} periodOK:${resultado.periodOK})`);
      return resultado;
    }

    const sessionId = randomUUID();
    const ttlSegundos = Math.max(1, Math.floor((Date.parse(resultado.authzJwt.expISO) - Date.now()) / 1000));
    this.logger.debug(
      `validarYCrearSesion: guardando en Redis — repo:${REPOSITORIO_SESIONES_PERFILAMIENTO} sessionId:${sessionId} ttlSegundos:${ttlSegundos} jti:${resultado.authzJwt.jti}`,
    );

    const sesion: SesionPerfilamientoPersistida = {
      sessionVariables: resultado.sessionVariables,
      jti: resultado.authzJwt.jti,
      expISO: resultado.authzJwt.expISO,
    };

    const guardadoOk = await this.persistenciaService.repositorio.guardar(sessionId, REPOSITORIO_SESIONES_PERFILAMIENTO, sesion, {
      ttlSegundos,
    });
    this.logger.log(
      `Sesión creada [${sessionId}] para RUT ${resultado.sessionVariables._RUTUSU || '(sin RUT)'} — guardadoOk:${guardadoOk}`,
    );

    return {
      validatedOK: true,
      periodOK: true,
      sessionId,
      sessionVariables: resultado.sessionVariables,
      expISO: resultado.authzJwt.expISO,
    };
  }
}
