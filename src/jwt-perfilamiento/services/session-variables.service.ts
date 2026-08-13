import { Injectable, Logger } from '@nestjs/common';
import { JwtVerificationService } from './jwt-verification.service.js';
import { JwtMapperService } from './jwt-mapper.service.js';
import { AlcanceResolverService } from './alcance-resolver.service.js';
import type { AuthzJWT } from '../interfaces/authz-jwt.interface.js';
import type { SessionVariables } from '../interfaces/session-variables.interface.js';
import type { ValidationResult } from '../interfaces/validation-result.interface.js';
import { RAIZ_ALCANCE_EMPRESA } from '../constants.js';

/** RUT normalizado: limpia formato, valida caracteres, completa a 8+DV. */
function normalizarRut(raw: string): { completo: string; sinDv: string; dv: string } {
  const limpio = raw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (!limpio) return { completo: '', sinDv: '', dv: '' };
  const dv = limpio.slice(-1);
  const cuerpo = limpio.slice(0, -1).padStart(8, '0');
  return { completo: cuerpo + dv, sinDv: cuerpo, dv };
}

function buscarPI(aud: AuthzJWT['aud'], tipo: string): string {
  const item = aud.PI.find((p) => p.PI_Tipo.toUpperCase() === tipo.toUpperCase());
  return item?.PI_Valor ?? '';
}

/**
 * Getter genérico por etiqueta (doc §5.4, dispatcher `GetElemento_JWT`),
 * case-insensitive, sobre un `AuthzJWT` ya validado.
 */
export function getElementoJWT(authzJwt: AuthzJWT, etiqueta: string): string | number | null {
  switch (etiqueta.toLowerCase()) {
    case 'rutholder':
      return normalizarRut(buscarPI(authzJwt.aud, 'RUT')).completo;
    case 'rutholdernodv':
      return normalizarRut(buscarPI(authzJwt.aud, 'RUT')).sinDv;
    case 'rutholderdv':
      return normalizarRut(buscarPI(authzJwt.aud, 'RUT')).dv;
    case 'nombreholder':
      return `${authzJwt.aud.AgenteName} ${authzJwt.aud.AgenteLastName}`.trim();
    case 'correoholder':
      return buscarPI(authzJwt.aud, 'CORREO');
    case 'keyholder':
      return authzJwt.aud.AgenteKey;
    case 'perfilidl':
      return authzJwt.rol.PerfilIdL;
    case 'perfilname':
      return authzJwt.rol.PerfilName;
    case 'perfildes':
      return authzJwt.rol.PerfilDescripcion;
    case 'nombrerol':
      return authzJwt.rol.RolName;
    case 'keyrol':
      return authzJwt.rol.RolKey;
    case 'asignacionac':
      return authzJwt.asignacion;
    case 'alcancepathac':
      return authzJwt.rol.Alcance.map((a) => a.AlcancePath).join('|');
    case 'alcancetemplatepathac':
      return authzJwt.rol.Alcance.map((a) => a.AlcanceTemplatePath).join('|');
    case 'atribpathac':
      return authzJwt.rol.Atribucion.map((a) => a.AtribucionPath).join('|');
    case 'atribpropac':
      return authzJwt.rol.Atribucion.map((a) => a.Propiedad).join('|');
    case 'inijwt':
      return authzJwt.nbfISO;
    case 'finjwt':
      return authzJwt.expISO;
    case 'regtimejwt':
      return authzJwt.iatISO;
    case 'nombreissuer':
      return authzJwt.issuerNombre;
    case 'serialnumber':
      return authzJwt.jti;
    case 'sigalg':
      return 'RS256';
    case 'reentry':
      return authzJwt.reentryUrl;
    default:
      return null;
  }
}

/**
 * Orquesta verificación + mapeo + resolución de alcances (doc §4, pipeline
 * completo) y produce el diccionario de variables de sesión (doc §5).
 */
@Injectable()
export class SessionVariablesService {
  private readonly logger = new Logger(SessionVariablesService.name);

  constructor(
    private readonly jwtVerification: JwtVerificationService,
    private readonly jwtMapper: JwtMapperService,
    private readonly alcanceResolver: AlcanceResolverService,
  ) {}

  async validar(jwtCrudo: string, parametro?: string, opciones: { ahora?: Date } = {}): Promise<ValidationResult> {
    this.logger.debug(`validar: pipeline iniciado (jwt de ${jwtCrudo.length} chars, parametro="${parametro ?? ''}")`);
    const verificacion = await this.jwtVerification.verificar(jwtCrudo, opciones);

    if (!verificacion.ok) {
      if (verificacion.tipo === 'periodo_invalido') {
        this.logger.warn('validar: pipeline detenido en verificación — periodo_invalido');
        return { validatedOK: true, periodOK: false, reentryUrl: verificacion.reentryUrl };
      }
      this.logger.warn(`validar: pipeline detenido en verificación — ${verificacion.tipo}`);
      return { validatedOK: false, periodOK: false, errorTipo: verificacion.tipo };
    }

    const mapeo = this.jwtMapper.mapear(verificacion.payload, jwtCrudo);
    if (!mapeo.ok) {
      this.logger.warn(`validar: pipeline detenido en mapeo — ${mapeo.tipo}`);
      return { validatedOK: false, periodOK: false, errorTipo: mapeo.tipo };
    }

    const { authzJwt } = mapeo;
    const { alcances, problemas } = this.alcanceResolver.resolver(authzJwt.rol.Alcance);
    const rut = normalizarRut(buscarPI(authzJwt.aud, 'RUT'));

    const sessionVariables: SessionVariables = {
      _RUTUSU: rut.completo,
      RUTNODV: rut.sinDv,
      RUTDV: rut.dv,
      _NOMUSU: `${authzJwt.aud.AgenteName} ${authzJwt.aud.AgenteLastName}`.trim(),
      _CORREO: buscarPI(authzJwt.aud, 'CORREO'),
      _NOTPERFIL: authzJwt.rol.PerfilIdL,
      _NOTPERFILDES: authzJwt.rol.PerfilDescripcion,
      _NODORAIZ: parametro ?? '',
      PARAMETROENTRADA: parametro ?? '',
      CHGROLURI: authzJwt.reentryUrl,
      alcances,
    };

    const empresa = alcances[RAIZ_ALCANCE_EMPRESA];
    if (empresa) {
      sessionVariables.EmpresaKey = empresa['EmpresaKey'];
      sessionVariables.empkey = empresa['EmpresaKey'];
      sessionVariables._EmpKey = empresa['EmpresaKey'];
      sessionVariables.EmpresaRut = empresa['EmpresaRut'];
      sessionVariables.EmpresaNombre = empresa['EmpresaNombre'];
    }

    this.logger.log(
      `validar: pipeline OK — RUT:${sessionVariables._RUTUSU || '(vacío)'} Perfil:${sessionVariables._NOTPERFIL} empkey:${sessionVariables.empkey ?? '(sin Empresa)'} alcances:${Object.keys(alcances).join(',')}`,
    );
    return { validatedOK: true, periodOK: true, authzJwt, sessionVariables, problemas };
  }
}
