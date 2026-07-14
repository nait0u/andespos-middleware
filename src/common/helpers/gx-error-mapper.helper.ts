import { HttpException, HttpStatus } from '@nestjs/common';
import type { GxMessage } from '../interfaces/parameter.interfaces.js';

/**
 * Traduce el primer GxMessage de error (Type===1) al código HTTP que espera
 * el frontend. GeneXus reporta errores de negocio siempre con `Messages[]`
 * — no existe (por ahora) un catálogo formal de Id's de error que distinga
 * 409 (estado de nota) de 422 (regla matemática), por lo que se clasifica
 * heurísticamente según el texto de `Description`. Ajustar los patrones si
 * GeneXus estandariza códigos de error específicos.
 *
 * En los endpoints "solo Messages" (yaml: `type: array, items: Message`),
 * GeneXus responde con el array plano en éxito, pero con `{ Messages: [...] }`
 * envuelto en objeto cuando hay HTTP 409/500 de negocio (ver
 * `GenexusClientService.normalizeGxErrorBody`) — se aceptan ambas formas.
 */
export function throwGxHttpError(
  response: GxMessage[] | { Messages?: GxMessage[] } | undefined | null,
  context: string,
): void {
  const messages = Array.isArray(response) ? response : response?.Messages;
  if (!messages || messages.length === 0) return;
  const error = messages.find((m) => m.Type === 1);
  if (!error) return;

  throw new HttpException(
    { message: error.Description, code: error.Id, context },
    classifyDescription(error.Description ?? ''),
  );
}

function classifyDescription(description: string): HttpStatus {
  if (/token|sesi[oó]n\s*(expirad|inv[aá]lid)/i.test(description)) {
    return HttpStatus.UNAUTHORIZED;
  }
  if (/editando|estado.*nota.*venta|nota.*venta.*estado/i.test(description)) {
    return HttpStatus.CONFLICT;
  }
  if (/no\s*(existe|encontr|hay\s*resultados)/i.test(description)) {
    return HttpStatus.NOT_FOUND;
  }
  if (
    /lote/i.test(description) &&
    /debe|obligatori|requiere|seleccion/i.test(description)
  ) {
    return HttpStatus.PRECONDITION_REQUIRED;
  }
  return HttpStatus.UNPROCESSABLE_ENTITY;
}

/**
 * 412 Precondition Failed — faltan llaves de empresa/punto de acceso en el
 * contexto POS. Se valida en el BFF antes de llamar a GeneXus porque estas
 * llaves son obligatorias en todo endpoint transaccional de xVenta.
 */
export function assertContextoCompleto(
  empKey: number | undefined,
  puntoAccesoKey: number | undefined,
): void {
  if (!empKey || !puntoAccesoKey) {
    throw new HttpException(
      {
        message: 'Faltan llaves de contexto (EmpKey/PuntoAccesoKey)',
        context: 'ContextoPOS',
      },
      HttpStatus.PRECONDITION_FAILED,
    );
  }
}
