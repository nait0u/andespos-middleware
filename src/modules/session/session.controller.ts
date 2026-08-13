import { Controller, Get, Logger } from '@nestjs/common';
import { DispositivoService, TokenService } from '@andestec/api-dispositivos';
import type { SessionContext } from '../../common/interfaces/session.interfaces.js';
import type { SDTDispositivoInformacion } from '../../common/interfaces/device.interfaces.js';

@Controller('session')
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(
    private readonly dispositivoService: DispositivoService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * GET /session/context
   * Orquesta la obtencion de informacion del dispositivo, devolviendo un
   * objeto unificado para el frontend React.
   */
  @Get('context')
  async getContext(): Promise<SessionContext> {
    this.logger.log('Obteniendo contexto de sesion...');

    // Obtener informacion del dispositivo (con cache TTL 5 min)
    const dispositivoInfo =
      (await this.dispositivoService.LeerArchivoDispositivoInformacion()) as SDTDispositivoInformacion | null;

    if (!dispositivoInfo) {
      throw new Error('No se pudo obtener la informacion del dispositivo');
    }

    // Token generado con EmpKey como strControl (requerido por xVenta y APIs AndesPOS)
    const empKey = parseInt(process.env.POS_DEV_EMP_KEY ?? '0', 10);
    const tokenSeguridad = this.tokenService.TokenGen(String(empKey)) || '';

    return {
      Contexto: {
        EmpKey: parseInt(process.env.POS_DEV_EMP_KEY ?? '0', 10),
        Ambiente: dispositivoInfo.AmbienteId.trim(),
        TokenSeguridad: tokenSeguridad,
      },
    };
  }
}
