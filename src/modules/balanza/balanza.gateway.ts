import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { BalanzaContextStore } from './balanza-context.store.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import type { DeltaCarritoResponseDto } from '../../common/interfaces/venta-carrito-delta.interfaces.js';

interface RegistrarContextoPayload {
  empKey: number;
  puntoAccesoKey: number;
  dispositivoId: string;
  perfil: string;
  notaVentaKey: number;
}

/**
 * BalanzaGateway — canal WebSocket dedicado a la integración de hardware.
 *
 * El frontend se conecta al namespace `/balanza` y emite `registrar-contexto`
 * apenas carga la pantalla de venta (o cambia de NotaVenta). BalanzaListenerService
 * usa ese contexto para asociar cada peso detectado a la venta activa y
 * emite `carrito-actualizado` con el Delta resultante — sin intervención manual.
 */
@WebSocketGateway({
  namespace: 'balanza',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
export class BalanzaGateway {
  private readonly logger = new Logger(BalanzaGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly contextStore: BalanzaContextStore) {}

  @SubscribeMessage('registrar-contexto')
  registrarContexto(@MessageBody() payload: RegistrarContextoPayload): void {
    if (
      !payload?.empKey ||
      !payload?.puntoAccesoKey ||
      !payload?.notaVentaKey
    ) {
      this.logger.warn(
        '[Balanza] registrar-contexto con payload incompleto — ignorado',
      );
      return;
    }

    const ctx: IPosContext = {
      EmpKey: payload.empKey,
      PuntoAccesoKey: payload.puntoAccesoKey,
      PuntoAccesoDescripcion: '',
      EstacionTurnoIdl: '',
      EstacionIdl: payload.dispositivoId,
      Ambiente: '',
      DispositivoId: payload.dispositivoId,
      Modo: 'NotaVenta',
      VendedorKey: 0,
      TurnoCajaKey: 0,
      EstacionTurnoEsCaja: false,
      token: '',
      RutUsuario: '',
      RutUsuarioDV: '',
      NombreUsuario: '',
      Perfil: payload.perfil,
      PerfilDesc: '',
      Mandante: '',
      RutEmpresa: '',
      Sucursal: '',
    };

    this.contextStore.set({ ctx, notaVentaKey: payload.notaVentaKey });
    this.logger.log(
      `[Balanza] Contexto registrado — Dispositivo:${payload.dispositivoId} NotaVenta:${payload.notaVentaKey}`,
    );
  }

  emitirDelta(delta: DeltaCarritoResponseDto): void {
    this.server.emit('carrito-actualizado', delta);
  }

  emitirError(mensaje: string): void {
    this.server.emit('balanza-error', { mensaje });
  }
}
