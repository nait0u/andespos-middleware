import { Controller, Post, Get, Delete, Query } from '@nestjs/common';
import { PocSessionService } from './poc-session.service.js';

@Controller('poc-session')
export class PocSessionController {
  constructor(private readonly pocService: PocSessionService) {}

  @Get('set')
  async setPrueba(
    @Query('valor') valor: string = 'REACT_BFF_POC_GENEXUS',
    @Query('sessionId') sessionId: string = 'TEST_AISLADO_001',
  ) {
    const respuesta = await this.pocService.requestConCookies('SetPrueba', { ValorPrueba: valor }, sessionId) as { Mensaje?: string };

    return {
      sessionId,
      jsessionId: this.pocService.getJSessionId(sessionId),
      valorEnviado: valor,
      respuestaGenexus: respuesta,
      _hint: 'Busca el jsessionId en Tomcat Manager → /manager/html → Sessions del contexto /AndesPOS_API2602N',
    };
  }

  @Get('get')
  async getPrueba(@Query('sessionId') sessionId: string = 'TEST_AISLADO_001') {
    const respuesta = await this.pocService.requestConCookies('GetPrueba', {}, sessionId) as { ValorRecuperado: string };

    return {
      sessionId,
      jsessionId: this.pocService.getJSessionId(sessionId),
      valorRecuperado: respuesta?.ValorRecuperado ?? 'N/A',
      _hint: 'Si jsessionId coincide con el del /set, Tomcat mantuvo la sesión correctamente.',
    };
  }

  @Get('ver-cookies')
  verCookies(@Query('sessionId') sessionId: string = 'TEST_AISLADO_001') {
    const cookie = this.pocService.getCookies(sessionId);
    return {
      sessionId,
      jsessionId: this.pocService.getJSessionId(sessionId),
      cookieCompleta: cookie || null,
      activa: !!cookie,
    };
  }

  @Post('prueba-init')
  async probarInicializacion(
    @Query('perfil') perfil: 'JAIME' | 'CONSTANZA' = 'JAIME',
    @Query('session') sessionId: string = 'SESSION_TEST_DEFAULT',
  ) {
    this.pocService.limpiarSesion(sessionId);

    try {
      const cookie = await this.pocService.inicializarContextoMock(sessionId, perfil);
      const respuestaGet = await this.pocService.requestConCookies('GetPrueba', {}, sessionId);

      return {
        exito: true,
        perfilCargado: perfil,
        idSesion: sessionId,
        cookieAsignada: cookie,
        respuestaBackend: respuestaGet,
      };
    } catch (error) {
      return { exito: false, error: (error as Error).message };
    }
  }

  @Post('prueba-concurrencia')
  async probarSesionesConcurrentes(@Query('reset') reset?: string) {
    const idJaime = 'SESSION_CAJERO_01';
    const idConstanza = 'SESSION_ADMIN_01';

    if (reset === 'true') {
      this.pocService.limpiarSesion(idJaime);
      this.pocService.limpiarSesion(idConstanza);
    }

    const yaExisteJaime = !!this.pocService.getCookies(idJaime);
    const yaExisteConstanza = !!this.pocService.getCookies(idConstanza);
    const esPrimeraVez = !yaExisteJaime && !yaExisteConstanza;

    // Inicializar solo las sesiones que no existen aún
    if (!yaExisteJaime || !yaExisteConstanza) {
      await Promise.all([
        yaExisteJaime ? Promise.resolve() : this.pocService.inicializarContextoMock(idJaime, 'JAIME'),
        yaExisteConstanza ? Promise.resolve() : this.pocService.inicializarContextoMock(idConstanza, 'CONSTANZA'),
      ]);
    }

    const valorJaime = `CAJERO_${idJaime}`;
    const valorConstanza = `ADMIN_${idConstanza}`;

    // En la primera vez guardamos un valor en cada sesión para poder verificarlo después
    if (esPrimeraVez) {
      await Promise.all([
        this.pocService.requestConCookies('SetPrueba', { ValorPrueba: valorJaime }, idJaime),
        this.pocService.requestConCookies('SetPrueba', { ValorPrueba: valorConstanza }, idConstanza),
      ]);
    }

    // Recuperamos el valor: si Tomcat mantuvo la sesión, debe coincidir con lo que se guardó
    const [respuestaJaime, respuestaConstanza] = await Promise.all([
      this.pocService.requestConCookies('GetPrueba', {}, idJaime).catch((e: Error) => ({ error: e.message })),
      this.pocService.requestConCookies('GetPrueba', {}, idConstanza).catch((e: Error) => ({ error: e.message })),
    ]) as [{ ValorRecuperado?: string }, { ValorRecuperado?: string }];

    const cookieCaja = this.pocService.getCookies(idJaime);
    const cookieAdmin = this.pocService.getCookies(idConstanza);

    const sesionJaimePersiste = respuestaJaime?.ValorRecuperado === valorJaime;
    const sesionConstanzaPersiste = respuestaConstanza?.ValorRecuperado === valorConstanza;

    return {
      fase: esPrimeraVez ? 'INICIALIZACIÓN + SET + GET' : 'VERIFICACIÓN DE PERSISTENCIA (solo GET)',
      sesionesAisladas: cookieCaja !== cookieAdmin,
      persistenciaVerificada: sesionJaimePersiste && sesionConstanzaPersiste,
      sesionJaime: {
        id: idJaime,
        cookie: cookieCaja,
        inicializadaEstaVez: !yaExisteJaime,
        valorEsperado: valorJaime,
        valorRecuperado: respuestaJaime?.ValorRecuperado,
        persiste: sesionJaimePersiste,
      },
      sesionConstanza: {
        id: idConstanza,
        cookie: cookieAdmin,
        inicializadaEstaVez: !yaExisteConstanza,
        valorEsperado: valorConstanza,
        valorRecuperado: respuestaConstanza?.ValorRecuperado,
        persiste: sesionConstanzaPersiste,
      },
      _hint: esPrimeraVez
        ? 'Sesiones creadas y valores guardados. Llama de nuevo (sin ?reset) para verificar que Tomcat los mantiene.'
        : 'Sin reinicializar: si persiste=true, Tomcat mantiene el estado entre requests HTTP independientes.',
    };
  }

  @Delete('sesion')
  limpiarSesion(@Query('sessionId') sessionId: string = 'TEST_AISLADO_001') {
    this.pocService.limpiarSesion(sessionId);
    return {
      sessionId,
      mensaje: 'Sesión eliminada del middleware. La sesión en Tomcat expirará por inactividad.',
    };
  }
}
