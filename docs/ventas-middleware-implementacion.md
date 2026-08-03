# Módulo Ventas — Implementación middleware (NestJS)

Documentación técnica del estado actual del módulo `ventas` (BFF entre el frontend POS y el monolito GeneXus). Refleja el código en `src/modules/ventas/`, `src/core/genexus-client/` y `src/common/`.

## 1. Arquitectura general

```
Frontend POS
   │  x-pos-token / x-pos-user
   ▼
PosContextGuard  ──▶  IPosContext (@ContextoPOS)
   │
   ▼
VentasController  ──▶  VentasService  ──▶  GenexusClientService (Axios/HttpModule)
   │                                            │
   │                                    sesión Tomcat (cookie) + retry
   ▼                                            ▼
DTOs (class-validator)                   GeneXus (AndesPOS_API2602N / AdministradorDispositivos)
```

## 2. Herramientas y decoradores usados

### Decoradores NestJS (`ventas.controller.ts`)
- `@Controller('ventas')` a nivel de clase.
- `@UseGuards(PosContextGuard)` aplicado a **nivel de clase** — protege todos los endpoints del controller, no endpoint por endpoint.
- Métodos HTTP: `@Get`, `@Post`, `@Put` (no hay `@Delete` en este módulo todavía).
- `@Body()`, `@Query()` para bind de DTOs.
- `@Query('limit', new DefaultValuePipe(50), ParseIntPipe)` — pipes encadenados para parámetros primitivos de query (usado en `GET /ventas/pantalla/categorias-menu`).
- `@ContextoPOS()` — param decorator custom (`common/decorators/pos-context.decorator.ts`) que extrae `request.posContext` (poblado por el guard) usando `createParamDecorator`.

### Cliente HTTP hacia GeneXus
- `@nestjs/axios` (`HttpModule` / `HttpService`) inyectado en `GenexusClientService`.
- Todas las llamadas se hacen vía `firstValueFrom(this.httpService.<método>(...))` (conversión Observable→Promise de RxJS).
- No se usa `fetch` ni otro cliente; todo el tráfico saliente a GeneXus pasa por este único servicio centralizado (`src/core/genexus-client/genexus-client.service.ts`).
- Métodos soportados: GET, POST, PUT, DELETE (helpers privados `executeGet/executePost/executePut/executeDelete`, despachados por `executeByMethod`).

### Validación — DTOs con `class-validator` + `class-transformer`
Todos los DTOs del módulo (`src/modules/ventas/dto/*.ts`) siguen el mismo patrón:
- `@IsOptional()`, `@IsNotEmpty()`, `@IsString()`, `@IsInt()`, `@IsArray()`, `@Min()`.
- `@Type(() => Number)` de `class-transformer` para coercionar query params (siempre strings en HTTP) a `number` antes de `@IsInt()` — necesario porque Nest no transforma automáticamente sin `ValidationPipe({ transform: true })` explícito a nivel global.

DTOs existentes:
| DTO | Endpoint | Campos |
|---|---|---|
| `FiltrosVentasDto` | `POST /ventas/lista` | `lastSync?, fechaFiltro?, nota?, clienteNombreCompleto?` (todos string opcionales) |
| `CrearVentaDto` | `POST /ventas` | `clienteKey?: number` |
| `AnularVentaDto` | `POST /ventas/anular` | `notaVentaKey: number` (requerido) |
| `PantallaVentaInitDto` | `GET /ventas/pantalla/init` | `notaVentaKey?: number, pmodo?: string` |
| `PantallaVentaDto` | `GET /ventas/pantalla/totales`, `/carrito` | `notaVentaKey?: number` |
| `GetCartaTouchDto` | `GET /ventas/pantalla/carta-touch` | `notaVentaKey?: number` |
| `GetProductoDetallesDto` | `GET /ventas/pantalla/producto-detalles` | `mitemKey: number` (requerido, `@Min(1)`) |
| `GetSelectorGeneralDto` | `GET /ventas/pantalla/selector-general` | `textoBusqueda?, codigoBusqueda?` |
| `FiltroCategoriasDto` | `POST /ventas/pantalla/filtro-categorias` | `colCatClasificadoras?: string[], colCatBuscadoras?: string[], textoBusqueda?` |
| `GetClientesDto` | `GET /ventas/clientes` | `filtroRut?, filtroNombre?, filtroGenerico?` |
| `AsignarClienteDto` | `PUT /ventas/clientes/asignar` | `notaVentaKey: number, clienteKey: number` (ambos requeridos) |
| `EstadoCajaResponseDto` | response shape de `GET /ventas/estado-caja` | sin decoradores de validación (es DTO de salida) |

No hay `ValidationPipe` global visible en este recorte — se asume configurado en `main.ts` (fuera del alcance de este módulo).

### Caché
- `@nestjs/cache-manager` (`CacheModule.register({ ttl: 3600000 })`, 1h) registrado en `VentasModule`.
- `CACHE_MANAGER` inyectado con `@Inject(CACHE_MANAGER) private readonly cacheManager: Cache` en `VentasService`.
- Uso: `GET /ventas/pantalla/categorias-menu` — cachea la respuesta completa de GeneXus (`GetCategoriasMenu`) por `EmpKey` (`categorias_menu_emp_${ctx.EmpKey}`) y pagina localmente en el BFF (`slice(offset, offset+limit)`) sobre el array cacheado, sin volver a golpear a GeneXus en cada página.

### Módulo (`ventas.module.ts`)
```ts
imports: [GenexusClientModule, DeviceModule, CacheModule.register({ ttl: 3600000 })]
providers: [VentasService, PosContextGuard]
controllers: [VentasController]
```

## 3. Manejo de sesión — cookie JSESSIONID / headers hacia GeneXus

### 3.1 Autenticación entrante (frontend → middleware) — `PosContextGuard`

El guard soporta **dos paths** excluyentes, resueltos por headers:

**PATH A — Token M2406 (dispositivo físico / producción)**
- Header `x-pos-token: <M2406>` → validado con `DeviceService.tokenVal(token, empKey)`.
- Token M2406 no codifica identidad de usuario; el perfil (`posadmcert` vs `CAJERAADMINISTRATIVA`) se infiere del header/env `x-pos-estacion-es-caja`.
- Headers adicionales leídos (con fallback a variables de entorno `POS_DEV_*` para desarrollo):
  - `x-pos-emp-key`, `x-pos-punto-acceso-key`, `x-pos-punto-acceso-desc`, `x-pos-estacion-turno-idl`, `x-pos-vendedor-key`, `x-pos-turno-caja-key`, `x-pos-estacion-es-caja`, `x-pos-modo` (default `'NotaVenta'`).

**PATH B — Usuario directo (`x-pos-user`, solo `NODE_ENV !== 'production'`)**
- Header `x-pos-user: base64(JSON)` con `{ rut, rutDv, nombre, perfil, perfilDesc, mandante, rutEmpresa, sucursal?, esCaja? }`.
- No requiere archivos de dispositivo; `DispositivoId = 'DEV-{rut}'` (cada usuario obtiene su propia sesión Tomcat).
- Pensado como puente temporal mientras no exista JWT.

Ambos paths pueblan `request.posContext: IPosContext` (interfaz en `common/interfaces/pos-context.interface.ts`), inyectado luego a los controllers vía `@ContextoPOS()`.

### 3.2 Sesión saliente (middleware → GeneXus) — `GenexusClientService`

GeneXus mantiene estado de sesión vía **cookie de Tomcat** (equivalente a JSESSIONID), gestionada así:

- **Clave de sesión interna**: `sessionKey = \`${DispositivoId}::${Perfil}\`` — un mismo dispositivo físico bajo perfiles distintos (admin vs cajero) requiere sesiones/cookies separadas, porque `InicializarContexto` puebla variables de contexto (`SDTContextoVenta`) específicas del perfil.
- **Cache de cookies en memoria**: `Map<string, string> sessionCookies` (clave: `sessionKey`) y `Map<string, number> sessionEmpKeys` (EmpKey autoritativo devuelto por GeneXus). No hay persistencia externa (Redis, etc.) — vive en memoria del proceso Node.
- **Lazy-init con deduplicación de concurrencia**: `ensureSessionInitialized()` usa `sessionInitPromises: Map<string, Promise<void>>` para que llamadas concurrentes al mismo dispositivo/perfil no disparen múltiples `InicializarContexto` en paralelo (single-flight).
- **Inicialización** (`initializeSession`):
  1. Resuelve `PERFIL_CONFIG[ctx.Perfil]` (mapeo estático en `common/constants/perfil-config.ts`) — si el perfil no está configurado, lanza `InternalServerErrorException` (fail-fast, no se adivinan valores).
  2. Genera un **token B2B** con `DeviceService.tokenGen(RutEmpresa + RutUsuario)`.
  3. `POST` a `POS/AI_API/Sesion/SessionAPI/InicializarContexto` con `{ SDTIniSessionTest: {...}, token }`, `withCredentials: true`.
  4. Extrae la cookie de `response.headers['set-cookie']`, la normaliza (`c.split(';')[0]` por cada cookie, unidas con `'; '`) y la guarda en `sessionCookies`.
  5. Guarda `EmpKey` autoritativo devuelto por GeneXus (no viene en el schema de entrada, GeneXus lo deriva de `PuntoAccesoKey`/`RutEmpresa`).
- **Inyección de la cookie en cada request**: `buildHeaders(cookie, extra)` arma:
  ```ts
  { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: <cookie>, ...extra }
  ```
- **Retry automático por expiración de sesión**: si la llamada a GeneXus responde `401 | 403 | 500` (`SESSION_ERROR_CODES`) y no es un error de negocio (ver 3.3), el servicio:
  1. Borra la cookie/EmpKey cacheados para ese `sessionId`.
  2. Reinvoca `initializeSession()`.
  3. Reintenta la request original una vez con la cookie nueva.
  4. Si el reintento falla, clasifica y relanza (`classifyAndThrow`).

### 3.3 Distinción error de sesión vs error de negocio

GeneXus puede devolver HTTP 500 tanto por caída de sesión como por errores de negocio del procedure (con `Messages` en el body). `GenexusClientService` distingue:
- `isGxBusinessErrorBody()` detecta `{ Messages: [...] }` o `{ Mensaje: "<MessageList>..." }` (XML embebido, usado en algunos procedures legacy como `UploadPreciosNativo`).
- `normalizeGxErrorBody()` parsea el XML embebido a un array `Messages` compatible.
- Si el body es un error de negocio y el status **no** es 401/403, se devuelve el body normalizado al servicio (no se reintenta sesión) para que `throwIfErrors()` lo traduzca en una excepción HTTP controlada (`422 Unprocessable Entity`).
- 401/403 siempre se tratan como error de sesión (fuerza reinicio de cookie) aunque el body traiga `Messages`.

### 3.4 Token de request individual (no confundir con la cookie de sesión)

Además de la cookie Tomcat, **cada llamada de negocio** a GeneXus (`GetEstadoCaja`, `CrearNuevaVenta`, etc.) lleva un campo `Token` en el payload, generado por `VentasService.tokenParaEmpresa(ctx)`:
```ts
DeviceService.tokenGen(String(ctx.EmpKey).trim())
```
Este token (formato `M2406`: versión + DispositivoId + timestamp + hash MD5) es una firma HMAC/MD5 propia del legacy GeneXus, distinta de la cookie de sesión — la cookie autentica la sesión Tomcat, el `Token` autentica la operación puntual con `strControl = EmpKey`.

### 3.5 Selección de baseURL — `target: 'admin' | 'pos'`

`GenexusClientService.request()` recibe `{ target, contexto }`:
- `target: 'pos'` → usa `process.env.GX_POS_BASE_URL` (AndesPOS_API2602N) y **requiere** `contexto` (para resolver `sessionKey`); dispara `ensureSessionInitialized()` antes de la llamada.
- `target: 'admin'` (default) → usa `LocationAdministradorDispositivos.txt` (host/port/baseUrl leídos de disco) — usado por `DeviceService` para operaciones de pareo/token que no requieren sesión Tomcat (`GetDispositivoClave`, `GetDispositivoInformacion`).

**Todos los endpoints del módulo Ventas usan `target: 'pos'`.** Omitir este flag envía la request al servidor equivocado (ver memoria de proyecto sobre routing GeneXus).

## 4. Endpoints implementados (`VentasController`)

| Método | Ruta | Service method | Endpoint GeneXus |
|---|---|---|---|
| GET | `/ventas/estado-caja` | `obtenerEstadoCaja` | `xInitVenta/GetEstadoCaja` |
| POST | `/ventas/lista` | `obtenerListaVentas` | `xInitVenta/GetListaVentas` (delta-sync vía `lastSync`) |
| POST | `/ventas` | `crearNuevaVenta` | `xInitVenta/CrearNuevaVenta` |
| POST | `/ventas/anular` | `anularVenta` | `xInitVenta/AnularVenta` |
| GET | `/ventas/pantalla/init` | `obtenerPantallaVentaInit` | `xVenta/GetPantallaVentaInit` |
| GET | `/ventas/pantalla/totales` | `obtenerVentaTotales` | `xVenta/GetPantallaVentaTotales` |
| GET | `/ventas/pantalla/carrito` | `obtenerVentaCarrito` | `xVenta/GetPantallaVentaCarrito` (delta-sync) |
| GET | `/ventas/pantalla/carta-touch` | `obtenerCartaTouch` | `xVenta/GetCartaTouchInicial` |
| GET | `/ventas/pantalla/producto-detalles` | `obtenerProductoDetalles` | `xVenta/GetProductoDetallesVenta` |
| GET | `/ventas/pantalla/selector-general` | `obtenerSelectorGeneral` | `xVenta/GetSelectorProductoGeneral` |
| GET | `/ventas/pantalla/categorias-menu` | `obtenerCategoriasMenuPaginado` | `xVenta/GetCategoriasMenu` (cacheado 1h + paginado local) |
| POST | `/ventas/pantalla/filtro-categorias` | `filtrarCategorias` | `xVenta/GetSelectorFiltroCategorias` |
| GET | `/ventas/clientes` | `obtenerClientes` | `xVenta/GetClientes` |
| PUT | `/ventas/clientes/asignar` | `asignarCliente` | `xVenta/AsignarCliente` |

## 5. Manejo de errores

- `VentasService.throwIfErrors(messages, context)`: revisa el array `Messages` de la respuesta GeneXus; si hay un mensaje con `Type === 1` (error), lanza `HttpException` con status `422 Unprocessable Entity` y body `{ message, code, context }`.
- `crearNuevaVenta` usa una variante inline con `InternalServerErrorException` en vez de `HttpException` (inconsistencia menor respecto al resto de métodos).
- `GenexusClientService.classifyAndThrow(msg)` clasifica errores de transporte:
  - `ECONNREFUSED|ENOTFOUND|EHOSTUNREACH` → `BadGatewayException` (502).
  - `timeout|ETIMEDOUT` → `GatewayTimeoutException` (504).
  - Resto → `InternalServerErrorException` (500).

## 6. Logging

Todos los métodos de `VentasService` loguean con prefijo `[SessionHandler]` incluyendo `Emp`, `Dispositivo`, `Punto`/`Turno` según corresponda, en entrada y salida (OK) de cada llamada — vía `Logger` de `@nestjs/common`, sin librería externa de logging.

## 7. Testing

- `test/ventas-carta-touch.e2e-spec.ts` — e2e spec agregado para el endpoint `GET /ventas/pantalla/carta-touch`, registrado en `test/jest-e2e.json`.
