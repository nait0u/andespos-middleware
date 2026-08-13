import { Body, Controller, Logger, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SetsessionService } from './setsession.service.js';
import { SetsessionDto } from './dto/setsession.dto.js';
import { COOKIE_SESSION_ID } from '../../common/constants/session-store.constants.js';

/**
 * `POST api/setsession` — receptor del JWT que emite Perfilamiento (AC), doc §2.
 * Único punto de entrada: acepta el JWT por body JSON/form o query string,
 * valida+mapea vía el paquete `jwt-perfilamiento`, crea la sesión en Redis y
 * responde con negociación de contenido (JSON para AJAX, HTML+redirect para
 * acceso directo de navegador — doc §2.2).
 */
@Controller('api/setsession')
export class SetsessionController {
  private readonly logger = new Logger(SetsessionController.name);

  constructor(private readonly setsessionService: SetsessionService) {}

  @Post()
  async setsession(
    @Body() body: SetsessionDto,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(
      `[1/5] Request recibida — Content-Type:${req.headers['content-type']} Accept:${req.headers['accept']} bodyKeys:${Object.keys(body ?? {}).join(',')} queryKeys:${Object.keys(query ?? {}).join(',')}`,
    );

    const jwt = body.JWT ?? body.jwt ?? query['JWT'] ?? query['jwt'];
    const parametro = body.parametro ?? query['parametro'] ?? this.parametroDesdeQueryBare(query);
    this.logger.log(`[2/5] JWT extraído: ${jwt ? `presente (${jwt.length} chars)` : 'AUSENTE'} — parametro:"${parametro ?? ''}"`);

    if (!jwt) {
      this.logger.warn('[2/5] Sin JWT en body/query — 400');
      this.responder(req, res, 400, {
        success: false,
        message: 'JWT ausente',
        validatedOK: false,
        periodOK: false,
      });
      return;
    }

    const resultado = await this.setsessionService.validarYCrearSesion(jwt, parametro);
    this.logger.log(`[3/5] Resultado validación — validatedOK:${resultado.validatedOK} periodOK:${resultado.periodOK}`);

    if (!resultado.validatedOK) {
      this.logger.warn(`[3/5] JWT inválido — errorTipo:${resultado.errorTipo}`);
      this.responder(req, res, resultado.errorTipo === 'clave_publica_invalida' ? 503 : 401, {
        success: false,
        message: 'No fue posible validar el JWT',
        validatedOK: false,
        periodOK: false,
        errorTipo: resultado.errorTipo,
      });
      return;
    }

    if (!resultado.periodOK) {
      this.logger.warn(`[3/5] JWT no vigente — reentryUrl:${resultado.reentryUrl ?? '(ninguna)'}`);
      this.responder(req, res, 401, {
        success: false,
        message: 'El token no está vigente',
        validatedOK: true,
        periodOK: false,
        reentryUrl: resultado.reentryUrl,
      });
      return;
    }

    this.logger.log(
      `[4/5] Sesión creada — sessionId:${resultado.sessionId} RUT:${resultado.sessionVariables._RUTUSU || '(vacío)'} empkey:${resultado.sessionVariables.empkey ?? '(vacío)'} exp:${resultado.expISO}`,
    );

    res.cookie(COOKIE_SESSION_ID, resultado.sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(resultado.expISO),
    });

    const redirectUrl = this.construirRedirectUrl(parametro);
    this.logger.log(`[5/5] Cookie ${COOKIE_SESSION_ID} seteada — redirectUrl:${redirectUrl}`);

    this.responder(
      req,
      res,
      200,
      {
        success: true,
        message: 'Sesion creada exitosamente',
        validatedOK: true,
        periodOK: true,
        sessionId: resultado.sessionId,
        userRut: resultado.sessionVariables._RUTUSU,
        empkey: resultado.sessionVariables.empkey ?? '',
        authSystem: 'JWT',
        redirectUrl,
        expiresAt: resultado.expISO,
      },
      redirectUrl,
    );
  }

  /** `?OnBoarding` (query key sin valor) se interpreta como nodo raíz — doc §2.1. */
  private parametroDesdeQueryBare(query: Record<string, string>): string | undefined {
    const clave = Object.keys(query).find((k) => query[k] === '' && k.toLowerCase() !== 'jwt');
    return clave;
  }

  private construirRedirectUrl(parametro?: string): string {
    const base = process.env.CORS_ORIGIN || 'http://localhost:5173';
    return parametro ? `${base.replace(/\/$/, '')}/${parametro}` : base;
  }

  /** Negociación de contenido (doc §2.2): JSON para AJAX, HTML+redirect para navegador directo. */
  private responder(req: Request, res: Response, status: number, json: Record<string, unknown>, redirectUrl?: string): void {
    const accept = req.headers['accept'] ?? '';
    const esAjax = accept.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (esAjax || !redirectUrl) {
      res.status(status).json(json);
      return;
    }

    res.status(status).type('html').send(`<!DOCTYPE html>
<html>
<head><meta http-equiv="refresh" content="0;url=${redirectUrl}"></head>
<body><script>window.location.replace(${JSON.stringify(redirectUrl)});</script></body>
</html>`);
  }
}
