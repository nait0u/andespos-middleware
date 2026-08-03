import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';
import { VentasModule } from '../src/modules/ventas/ventas.module';

/**
 * E2E contra el GeneXus real (GX_POS_BASE_URL en .env) — sin mocks.
 * Requiere que el servidor GeneXus esté arriba y sea alcanzable desde esta
 * máquina, y que los archivos de dispositivo (LocationAdministradorDispositivos.txt,
 * DispInfo.txt) existan localmente para InicializarContexto/tokenGen.
 *
 * Usa el path x-pos-user (solo habilitado fuera de producción) con el perfil
 * 'posadmcert' definido en PERFIL_CONFIG.
 */
describe('GET /ventas/pantalla/carta-touch (e2e real GeneXus)', () => {
  let app: INestApplication<App>;

  const xPosUser = Buffer.from(
    JSON.stringify({
      rut: '18373061',
      rutDv: '183730614',
      nombre: 'CONSTANZA PALOMO MIRANDA',
      perfil: 'posadmcert',
      perfilDesc: 'POS Administrador Certificador',
      mandante: '76407930',
      rutEmpresa: '500000023',
      sucursal: '',
    }),
  ).toString('base64');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), VentasModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('trae la carta touch con precios y stock ya sanitizados por el BFF', async () => {
    const res = await request(app.getHttpServer())
      .get('/ventas/pantalla/carta-touch')
      .set('x-pos-user', xPosUser)
      .set('x-pos-emp-key', '1008')
      .set('x-pos-punto-acceso-key', '2')
      .expect(200);

    expect(res.body).toHaveProperty('cartaGrupos');
    expect(Array.isArray(res.body.cartaGrupos)).toBe(true);

    const productos = res.body.cartaGrupos.flatMap((g: any) => g.productos ?? []);
    expect(productos.length).toBeGreaterThan(0);

    for (const p of productos) {
      // stock: siempre número, nunca NaN/undefined
      expect(typeof p.productoStock).toBe('number');
      expect(Number.isNaN(p.productoStock)).toBe(false);

      // precio: siempre string moneda chilena ('$ 0' o '$ 1.234'), nunca "PreciosX" ni crudo
      expect(typeof p.productoPrecios).toBe('string');
      expect(p.productoPrecios).not.toBe('PreciosX');
      expect(p.productoPrecios).toMatch(/^\$ [\d.]+$/);
    }

    console.log(
      'Muestra sanitizada:',
      productos
        .slice(0, 5)
        .map((p: any) => ({
          codigo: p.productoCodigo,
          stock: p.productoStock,
          precio: p.productoPrecios,
        })),
    );
  }, 30000);
});
