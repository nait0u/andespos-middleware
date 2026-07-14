import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * TransformInterceptor
 *
 * Las respuestas de GeneXus suelen venir anidadas en SDTs con wrappers
 * redundantes (ej: { SDTParametrosValuesApp: { ParametrosValuesApp: [...] } }).
 *
 * Este interceptor aplana la respuesta eliminando capas de anidamiento
 * innecesarias antes de enviarla al frontend React.
 *
 * Reglas de aplanamiento:
 * 1. Si el body es un objeto con una sola key que apunta a otro objeto,
 *    se desenvuelve un nivel.
 * 2. Si el objeto resultante tiene una key que empieza con "SDT",
 *    se desenvuelve ese nivel tambien.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Record<string, unknown>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Record<string, unknown>> {
    return next.handle().pipe(
      map((data) => {
        if (!data || typeof data !== 'object') {
          return data as unknown as Record<string, unknown>;
        }

        let result = data as Record<string, unknown>;

        // Paso 1: desenvolver SDT wrappers de GeneXus (ej: { SDTParametroEstructura: {...} })
        const keys = Object.keys(result);
        for (const key of keys) {
          if (
            key.startsWith('SDT') &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(result[key])
          ) {
            const inner = result[key] as Record<string, unknown>;
            const { [key]: _removed, ...rest } = result;
            result = { ...rest, ...inner };
            break;
          }
        }

        // Paso 2: desenvolver ParametroValueArray (GeneXus envuelve los arrays de parametros
        // en { ParametrosValuesApp: { ParametroValueArray: [...] } })
        result = this.unwrapValueArrays(result);

        return result;
      }),
    );
  }

  private unwrapValueArrays(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const inner = v as Record<string, unknown>;
        if (Array.isArray(inner['ParametroValueArray'])) {
          out[k] = inner['ParametroValueArray'];
        } else {
          out[k] = this.unwrapValueArrays(inner);
        }
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
