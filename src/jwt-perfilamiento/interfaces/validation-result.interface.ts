import type { AuthzJWT } from './authz-jwt.interface.js';
import type { Problema } from './problema.interface.js';
import type { SessionVariables } from './session-variables.interface.js';

export type ErrorTipo =
  | 'token_malformado'
  | 'alg_invalido'
  | 'firma_invalida'
  | 'clave_publica_invalida'
  | 'iss_invalido'
  | 'estructura_invalida';

/**
 * Resultado de validar un JWT de Perfilamiento (doc §2.2).
 * `validatedOK`/`periodOK` son el contrato de respuesta institucional; el
 * resto de los campos son detalle interno para diagnóstico y para construir
 * la respuesta HTTP en la app consumidora.
 */
export type ValidationResult =
  | {
      validatedOK: true;
      periodOK: true;
      authzJwt: AuthzJWT;
      sessionVariables: SessionVariables;
      problemas: Problema[];
    }
  | {
      validatedOK: true;
      periodOK: false;
      reentryUrl: string | null;
    }
  | {
      validatedOK: false;
      periodOK: false;
      errorTipo: ErrorTipo;
    };
