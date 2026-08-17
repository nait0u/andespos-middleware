import { Injectable, Logger } from '@nestjs/common';
import { PerfilamientoParametrosService } from '@andestec/api-parametros-perfilamiento';
import type { PublicKeyUrlResolver } from '@andestec/jwt-perfilamiento';

/**
 * Resuelve la URL de la clave pública de Perfilamiento (`PublicKeyPrfURL`) vía el
 * sistema de parámetros institucional en vez de un env var estático — ver Fase 3
 * del plan. Si esto falla (red, backend caído), `PublicKeyLoaderService` cae al
 * fallback por env var (`JWT_PERFILAMIENTO_PUBLIC_KEY_URL`), si está configurado.
 */
@Injectable()
export class PerfilamientoPublicKeyUrlResolver implements PublicKeyUrlResolver {
  private readonly logger = new Logger(PerfilamientoPublicKeyUrlResolver.name);

  constructor(private readonly perfilamientoParametros: PerfilamientoParametrosService) {}

  async obtenerUrl(): Promise<string | null> {
    const empKey = parseInt(process.env.POS_DEV_EMP_KEY ?? '0', 10);
    const valor = await this.perfilamientoParametros.GetParametroPerfilamiento('PublicKeyPrfURL', { empKey });

    if (!valor) {
      this.logger.warn('obtenerUrl: PublicKeyPrfURL vino vacío desde el sistema de parámetros');
      return null;
    }

    this.logger.debug(`obtenerUrl: PublicKeyPrfURL resuelto dinámicamente → ${valor}`);
    return valor;
  }
}
