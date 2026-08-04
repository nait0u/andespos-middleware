import { Controller, Get, Logger } from '@nestjs/common';
import { DispositivoService, TokenService } from '@andestec/api-dispositivos';
import type { SDTDispositivoInformacion } from '../../common/interfaces/device.interfaces.js';

@Controller('device')
export class DeviceController {
  private readonly logger = new Logger(DeviceController.name);

  constructor(
    private readonly dispositivoService: DispositivoService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * GET /device/info
   * Retorna la informacion completa del dispositivo (con cache TTL 5 min).
   */
  @Get('info')
  async getDispositivoInformacion() {
    this.logger.log('Test: obteniendo informacion del dispositivo...');

    const dispositivoId = this.dispositivoService.GetDispositivoId();
    const info = (await this.dispositivoService.LeerArchivoDispositivoInformacion()) as SDTDispositivoInformacion | null;

    return {
      ok: !!info,
      dispositivoId,
      informacion: info,
    };
  }

  /**
   * GET /device/id
   * Prueba la lectura del DispositivoId (env DISPOSITIVO_ID).
   */
  @Get('id')
  getDispositivoId() {
    this.logger.log('Test: leyendo DispositivoId...');

    const id = this.dispositivoService.GetDispositivoId();

    return {
      ok: !!id,
      dispositivoId: id,
    };
  }

  /**
   * GET /device/token
   * Prueba la generacion del token de seguridad.
   */
  @Get('token')
  getToken() {
    this.logger.log('Test: generando token...');

    const dispositivoId = this.dispositivoService.GetDispositivoId();
    const token = this.tokenService.TokenGen(dispositivoId ?? '');

    return {
      ok: !!token,
      dispositivoId,
      token,
    };
  }
}
