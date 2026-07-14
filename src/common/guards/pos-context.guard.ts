import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { DeviceService } from '../../modules/device/device.service.js';
import type { IPosContext } from '../interfaces/pos-context.interface.js';

interface PosRequest extends Request {
  posContext: IPosContext;
}

/** Estructura esperada en el header x-pos-user (base64 JSON). Solo en no-producción. */
interface PosUserHeader {
  rut: string;
  rutDv: string;
  nombre: string;
  perfil: string;
  perfilDesc: string;
  mandante: string;
  rutEmpresa: string;
  sucursal?: string;
  /** Indica si el usuario opera en modo caja. Default: false */
  esCaja?: boolean;
}

/**
 * PosContextGuard — valida cada request entrante desde el frontend web POS.
 *
 * Soporta dos paths de autenticación:
 *
 *  PATH A — Token M2406 (dispositivo físico / producción):
 *    Header: x-pos-token: <M2406>
 *    Valida con DeviceService.tokenVal(). Extrae DispositivoId del token.
 *    Campos de usuario quedan vacíos (no están codificados en M2406).
 *
 *  PATH B — Usuario directo (desarrollo / pre-JWT):
 *    Header: x-pos-user: <base64(JSON)>
 *    Solo disponible cuando NODE_ENV !== 'production'.
 *    No requiere archivos de dispositivo. DispositivoId = 'DEV-{rut}'.
 *    Úsalo mientras el sistema de JWT no esté implementado.
 *
 * Aplicar a nivel de clase con @UseGuards(PosContextGuard).
 */
@Injectable()
export class PosContextGuard implements CanActivate {
  private readonly logger = new Logger(PosContextGuard.name);

  constructor(private readonly deviceService: DeviceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PosRequest>();

    const tokenHeader = request.headers['x-pos-token'] as string | undefined;
    const userHeader = request.headers['x-pos-user'] as string | undefined;
    const modo = (request.headers['x-pos-modo'] as string | undefined) ?? 'NotaVenta';

    if (tokenHeader) {
      return this.activateConToken(request, tokenHeader, modo);
    }

    if (userHeader && process.env.NODE_ENV !== 'production') {
      return this.activateConUsuario(request, userHeader, modo);
    }

    throw new UnauthorizedException(
      process.env.NODE_ENV === 'production'
        ? 'Header x-pos-token requerido'
        : 'Header x-pos-token (M2406) o x-pos-user (base64 JSON) requerido',
    );
  }

  // ── PATH A: M2406 ────────────────────────────────────────────────────────

  private async activateConToken(
    request: PosRequest,
    token: string,
    modo: string,
  ): Promise<boolean> {
    const empKeyRaw =
      (request.headers['x-pos-emp-key'] as string | undefined) ??
      process.env.POS_DEV_EMP_KEY ??
      '0';

    const validacion = await this.deviceService.tokenVal(token, empKeyRaw.trim());
    if (!validacion.valido) {
      this.logger.warn(`Token M2406 rechazado [${validacion.dispositivoId}]: ${validacion.mensaje}`);
      throw new UnauthorizedException(validacion.mensaje);
    }

    const dispositivoInfo = await this.deviceService.leerArchivoDispositivoInformacion();
    if (!dispositivoInfo) {
      throw new UnauthorizedException(
        'No se pudo verificar la información del dispositivo emparejado',
      );
    }

    const parseHeader = (key: string, envFallback: string): number => {
      const raw =
        (request.headers[key] as string | undefined) ??
        process.env[envFallback] ??
        '0';
      const val = parseInt(raw, 10);
      return isNaN(val) ? 0 : val;
    };
    const parseHeaderStr = (key: string, envFallback: string): string =>
      (request.headers[key] as string | undefined) ??
      process.env[envFallback] ??
      '';

    const estacionEsCajaRaw =
      (request.headers['x-pos-estacion-es-caja'] as string | undefined) ??
      process.env.POS_DEV_ESTACION_ES_CAJA ??
      'false';
    const esCaja = estacionEsCajaRaw === 'true';

    // M2406 no codifica identidad — resolvemos el Perfil por la señal de caja/admin
    // que viene en headers/env. GenexusClientService lo usa como clave en PERFIL_CONFIG.
    const perfilM2406 = esCaja ? 'CAJERAADMINISTRATIVA' : 'posadmcert';

    request.posContext = {
      EmpKey: parseHeader('x-pos-emp-key', 'POS_DEV_EMP_KEY'),
      PuntoAccesoKey: parseHeader('x-pos-punto-acceso-key', 'POS_DEV_PUNTO_ACCESO_KEY'),
      PuntoAccesoDescripcion: parseHeaderStr('x-pos-punto-acceso-desc', 'POS_DEV_PUNTO_ACCESO_DESC'),
      EstacionTurnoIdl: parseHeaderStr('x-pos-estacion-turno-idl', 'POS_DEV_ESTACION_TURNO_IDL'),
      EstacionIdl: dispositivoInfo.DispositivoId.trim(),
      Ambiente: dispositivoInfo.AmbienteId.trim(),
      DispositivoId: validacion.dispositivoId,
      Modo: modo,
      VendedorKey: parseHeader('x-pos-vendedor-key', 'POS_DEV_VENDEDOR_KEY'),
      TurnoCajaKey: parseHeader('x-pos-turno-caja-key', 'POS_DEV_TURNO_CAJA_KEY'),
      EstacionTurnoEsCaja: esCaja,
      token,
      // Identidad inferida del perfil M2406 (el token legacy no la codifica)
      RutUsuario: '',
      RutUsuarioDV: '',
      NombreUsuario: '',
      Perfil: perfilM2406,
      PerfilDesc: '',
      Mandante: '',
      RutEmpresa: '',
      Sucursal: '',
    };

    this.logger.debug(
      `[M2406] POS context OK — Dispositivo:${validacion.dispositivoId} Emp:${request.posContext.EmpKey} Modo:${modo}`,
    );
    return true;
  }

  // ── PATH B: x-pos-user (solo no-producción) ──────────────────────────────

  private activateConUsuario(
    request: PosRequest,
    userHeaderRaw: string,
    modo: string,
  ): boolean {
    let user: PosUserHeader;
    try {
      const decoded = Buffer.from(userHeaderRaw, 'base64').toString('utf-8');
      user = JSON.parse(decoded) as PosUserHeader;
    } catch {
      throw new UnauthorizedException(
        'x-pos-user: formato inválido — debe ser base64(JSON)',
      );
    }

    if (!user.rut || !user.nombre || !user.perfil) {
      throw new UnauthorizedException(
        'x-pos-user: campos requeridos faltantes (rut, nombre, perfil)',
      );
    }

    const parseHeader = (key: string, envFallback: string): number => {
      const raw =
        (request.headers[key] as string | undefined) ??
        process.env[envFallback] ??
        '0';
      const val = parseInt(raw, 10);
      return isNaN(val) ? 0 : val;
    };
    const parseHeaderStr = (key: string, envFallback: string): string =>
      (request.headers[key] as string | undefined) ??
      process.env[envFallback] ??
      '';

    const estacionEsCajaRaw =
      (request.headers['x-pos-estacion-es-caja'] as string | undefined) ??
      process.env.POS_DEV_ESTACION_ES_CAJA ??
      'false';

    // DispositivoId derivado del RUT: cada usuario tiene su propia sesión Tomcat
    const dispositivoId = `DEV-${user.rut.trim()}`;

    request.posContext = {
      EmpKey: parseHeader('x-pos-emp-key', 'POS_DEV_EMP_KEY'),
      PuntoAccesoKey: parseHeader('x-pos-punto-acceso-key', 'POS_DEV_PUNTO_ACCESO_KEY'),
      PuntoAccesoDescripcion: parseHeaderStr('x-pos-punto-acceso-desc', 'POS_DEV_PUNTO_ACCESO_DESC'),
      EstacionTurnoIdl: parseHeaderStr('x-pos-estacion-turno-idl', 'POS_DEV_ESTACION_TURNO_IDL'),
      EstacionIdl: dispositivoId,
      Ambiente: process.env.POS_DEV_AMBIENTE ?? 'DEV',
      DispositivoId: dispositivoId,
      Modo: modo,
      VendedorKey: parseHeader('x-pos-vendedor-key', 'POS_DEV_VENDEDOR_KEY'),
      TurnoCajaKey: parseHeader('x-pos-turno-caja-key', 'POS_DEV_TURNO_CAJA_KEY'),
      EstacionTurnoEsCaja: user.esCaja ?? estacionEsCajaRaw === 'true',
      token: '',
      // Identidad del usuario desde x-pos-user
      RutUsuario: user.rut.trim(),
      RutUsuarioDV: user.rutDv?.trim() ?? user.rut.trim(),
      NombreUsuario: user.nombre.trim(),
      Perfil: user.perfil.trim(),
      PerfilDesc: user.perfilDesc?.trim() ?? '',
      Mandante: user.mandante?.trim() ?? '',
      RutEmpresa: user.rutEmpresa?.trim() ?? '',
      Sucursal: user.sucursal?.trim() ?? '',
    };

    this.logger.debug(
      `[x-pos-user] POS context OK — DispositivoId:${dispositivoId} Usuario:${user.nombre} Perfil:${user.perfil} Emp:${request.posContext.EmpKey}`,
    );
    return true;
  }
}
