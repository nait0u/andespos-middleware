import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { watch, readFileSync, type FSWatcher } from 'fs';
import { GenexusClientService } from '../../core/genexus-client/genexus-client.service.js';
import { DeviceService } from '../device/device.service.js';
import { BalanzaContextStore } from './balanza-context.store.js';
import { BalanzaGateway } from './balanza.gateway.js';
import { mapVentaCarritoDelta } from '../../common/helpers/venta-carrito-delta.mapper.js';
import { throwGxHttpError } from '../../common/helpers/gx-error-mapper.helper.js';
import type { GxCarritoDeltaResponse } from '../../common/interfaces/venta-carrito-delta.interfaces.js';

/**
 * BalanzaListenerService — puente entre el hardware físico (balanza) y GeneXus.
 *
 * La balanza (o el driver/bridge del fabricante) escribe cada peso estabilizado
 * en un archivo temporal (`BALANZA_WATCH_FILE`). Este servicio observa ese
 * archivo con `fs.watch` — sin dependencias nativas ni acceso directo al puerto
 * COM, que queda a cargo del driver del fabricante — y ante cada peso válido:
 *
 *  1. Dispara AgregarBalanzaCarrito contra GeneXus con el contexto activo
 *     (registrado previamente por el frontend vía BalanzaGateway).
 *  2. Emite el Delta (carrito + totales) resultante por WebSocket para que
 *     la UI se actualice sin intervención manual del cajero.
 *
 * Debounce de 300ms: la balanza puede escribir múltiples lecturas intermedias
 * mientras el peso se estabiliza — solo la última lectura dentro de la ventana
 * se procesa.
 */
@Injectable()
export class BalanzaListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BalanzaListenerService.name);
  private static readonly GX_AGREGAR_BALANZA =
    'POS/AI_API/Venta/xVenta/AgregarBalanzaCarrito';
  private static readonly DEBOUNCE_MS = 300;

  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private ultimaTrama = '';

  constructor(
    private readonly genexusClient: GenexusClientService,
    private readonly deviceService: DeviceService,
    private readonly contextStore: BalanzaContextStore,
    private readonly gateway: BalanzaGateway,
  ) {}

  onModuleInit(): void {
    const watchFile = process.env.BALANZA_WATCH_FILE;
    if (!watchFile) {
      this.logger.warn(
        '[Balanza] BALANZA_WATCH_FILE no configurado — listener de hardware deshabilitado',
      );
      return;
    }

    try {
      this.watcher = watch(watchFile, () =>
        this.onArchivoModificado(watchFile),
      );
      this.logger.log(`[Balanza] Escuchando archivo de balanza: ${watchFile}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Balanza] No se pudo iniciar el watcher — ${msg}`);
    }
  }

  onModuleDestroy(): void {
    this.watcher?.close();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private onArchivoModificado(watchFile: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(
      () => this.procesarLectura(watchFile),
      BalanzaListenerService.DEBOUNCE_MS,
    );
  }

  private procesarLectura(watchFile: string): void {
    let trama: string;
    try {
      trama = readFileSync(watchFile, 'utf-8').trim();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Balanza] Error leyendo ${watchFile} — ${msg}`);
      return;
    }

    if (!trama || trama === this.ultimaTrama) return;
    this.ultimaTrama = trama;

    void this.agregarBalanzaCarrito(trama);
  }

  private async agregarBalanzaCarrito(tramaBalanza: string): Promise<void> {
    const contexto = this.contextStore.get();
    if (!contexto) {
      this.logger.warn(
        '[Balanza] Peso detectado pero no hay contexto de venta registrado — trama descartada',
      );
      return;
    }
    const { ctx, notaVentaKey } = contexto;

    this.logger.log(
      `[Balanza] Peso detectado → NotaVenta:${notaVentaKey} Emp:${ctx.EmpKey} trama:"${tramaBalanza}"`,
    );

    try {
      const token = this.deviceService.tokenGen(String(ctx.EmpKey).trim());
      if (!token)
        throw new Error(`No se pudo generar token para EmpKey=${ctx.EmpKey}`);

      const response = await this.genexusClient.request<GxCarritoDeltaResponse>(
        BalanzaListenerService.GX_AGREGAR_BALANZA,
        {
          EmpKey: ctx.EmpKey,
          PuntoAccesoKey: ctx.PuntoAccesoKey,
          NotaVentaKey: notaVentaKey,
          TramaBalanza: tramaBalanza,
          Token: token,
        },
        'POST',
        { target: 'pos', contexto: ctx },
      );

      throwGxHttpError(response.Messages, 'AgregarBalanzaCarrito');

      const delta = mapVentaCarritoDelta(response);
      this.gateway.emitirDelta(delta);
      this.logger.log(
        `[Balanza] AgregarBalanzaCarrito OK — NotaVenta:${notaVentaKey}`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[Balanza] Error AgregarBalanzaCarrito — NotaVenta:${notaVentaKey}: ${msg}`,
      );
      this.gateway.emitirError(msg);
    }
  }
}
