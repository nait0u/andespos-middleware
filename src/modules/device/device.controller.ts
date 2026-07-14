import { Controller, Get, Logger } from '@nestjs/common';
import { DeviceService } from './device.service.js';

@Controller('device')
export class DeviceController {
  private readonly logger = new Logger(DeviceController.name);

  constructor(private readonly deviceService: DeviceService) {}

  /**
   * GET /device/info
   * Retorna la informacion completa del dispositivo (con cache TTL 5 min).
   */
  @Get('info')
  async getDispositivoInformacion() {
    this.logger.log('Test: obteniendo informacion del dispositivo...');

    const dispositivoId = this.deviceService.getDispositivoId();
    const info = await this.deviceService.leerArchivoDispositivoInformacion();

    return {
      ok: !!info,
      dispositivoId,
      informacion: info,
    };
  }

  /**
   * GET /device/id
   * Prueba la lectura y desencriptacion del DispositivoId desde DispInfo.txt.
   */
  @Get('id')
  getDispositivoId() {
    this.logger.log('Test: leyendo DispositivoId...');

    const id = this.deviceService.getDispositivoId();

    return {
      ok: !!id,
      dispositivoId: id,
      pathDispositivo: this.deviceService.getPathDispositivo(),
    };
  }

  /**
   * GET /device/token
   * Prueba la generacion del token de seguridad.
   */
  @Get('token')
  getToken() {
    this.logger.log('Test: generando token...');

    const dispositivoId = this.deviceService.getDispositivoId();
    const token = this.deviceService.tokenGen(dispositivoId ?? '');

    return {
      ok: !!token,
      dispositivoId,
      token,
      timestamp: this.deviceService.getTimestampXML(),
    };
  }
}
