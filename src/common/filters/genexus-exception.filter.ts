import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * GenexusExceptionFilter
 *
 * Captura errores de red (consumos a GeneXus) y errores de parseo
 * de archivos fisicos (persistencia, configuracion XML, DispInfo.txt).
 *
 * IMPORTANTE: Nunca expone rutas de archivos del servidor al frontend.
 * Solo devuelve un codigo de error interno y un mensaje generico.
 */
@Catch()
export class GenexusExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GenexusExceptionFilter.name);

  /** Patrones que indican rutas de archivos en mensajes de error */
  private static readonly PATH_PATTERNS = [
    /[A-Z]:\\[^\s]+/gi, // Rutas Windows (C:\...)
    /\/opt\/[^\s]+/gi, // Rutas Linux (/opt/...)
    /\/home\/[^\s]+/gi, // Rutas home Linux
    /\/tmp\/[^\s]+/gi, // Rutas temporales
    /\/var\/[^\s]+/gi, // Rutas /var
  ];

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let errorCode = 'INTERNAL_ERROR';
    let extraFields: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else {
        const raw = exResponse as Record<string, unknown>;
        if (Array.isArray(raw.message)) {
          message = raw.message.map((v) => String(v)).join('; ');
        } else if (typeof raw.message === 'string') {
          message = raw.message;
        }
        // Preserva payload de negocio adicional (ej. `lotes`, `productoKey`,
        // `code`, `context` de gx-error-mapper.helper) que el frontend
        // necesita — sin esto, errores como el 428 de "lote requerido"
        // llegarían a React sin la lista de lotes para el selector.
        const rest = Object.fromEntries(
          Object.entries(raw).filter(
            ([key]) => !['message', 'statusCode', 'error'].includes(key),
          ),
        );
        if (Object.keys(rest).length > 0) extraFields = rest;
      }
    } else if (exception instanceof Error) {
      const errorMsg = exception.message;

      // Clasificar el tipo de error sin exponer rutas
      if (this.isNetworkError(errorMsg)) {
        status = HttpStatus.BAD_GATEWAY;
        message = 'Error de comunicacion con el servicio GeneXus';
        errorCode = 'GX_NETWORK_ERROR';
      } else if (this.isFileParseError(errorMsg)) {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Error al procesar configuracion del dispositivo';
        errorCode = 'GX_CONFIG_ERROR';
      } else if (this.isTimeoutError(errorMsg)) {
        status = HttpStatus.GATEWAY_TIMEOUT;
        message = 'Timeout al comunicarse con el servicio GeneXus';
        errorCode = 'GX_TIMEOUT';
      } else if (this.isCryptoError(errorMsg)) {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Error de autenticacion del dispositivo';
        errorCode = 'GX_CRYPTO_ERROR';
      }
    }

    // Sanitizar mensaje: nunca exponer rutas de archivos
    const sanitizedMessage = this.sanitizeMessage(message);

    // Log completo del error para el servidor (con rutas)
    const detalle =
      exception instanceof HttpException
        ? JSON.stringify(exception.getResponse())
        : exception instanceof Error
          ? exception.message
          : String(exception);
    this.logger.error(
      `[${errorCode}] ${detalle}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      ...extraFields,
      statusCode: status,
      errorCode,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
    });
  }

  private isNetworkError(msg: string): boolean {
    return /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|Error en el request/i.test(msg);
  }

  private isFileParseError(msg: string): boolean {
    return /ENOENT|parsear|configuracion|XML|DispInfo/i.test(msg);
  }

  private isTimeoutError(msg: string): boolean {
    return /timeout|ETIMEDOUT/i.test(msg);
  }

  private isCryptoError(msg: string): boolean {
    return /desencriptar|decrypt|cipher|token/i.test(msg);
  }

  /** Elimina cualquier ruta de archivo que pudiera filtrarse en el mensaje */
  private sanitizeMessage(message: unknown): string {
    let sanitized =
      typeof message === 'string' ? message : JSON.stringify(message);
    for (const pattern of GenexusExceptionFilter.PATH_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[ruta oculta]');
    }
    return sanitized;
  }
}
