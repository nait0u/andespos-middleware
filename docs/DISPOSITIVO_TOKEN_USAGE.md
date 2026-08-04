# Convención de uso — Identidad, Token y Persistencia del dispositivo

> **Leer antes de agregar cualquier código nuevo que necesite identidad del dispositivo,
> generación/validación de token, o persistencia asociada al dispositivo.**

---

## 1. Regla central: inyectar el paquete directamente, sin wrappers

No existe (ni debe crearse) una capa de facade local tipo `DeviceService`. Hasta hace poco existió una — era un wrapper puro de paso (*pass-through*) que solo traducía nombres de métodos hacia `@andestec/api-dispositivos`. Se eliminó porque:

- El paquete es de la misma organización — no hay riesgo de versionado sorpresa que justifique una capa de aislamiento.
- Cada método adicional en el wrapper es una traducción 1:1 sin lógica propia: puro costo de mantenimiento.

**Regla:** inyecta `DispositivoService` y/o `TokenService` de `@andestec/api-dispositivos` directamente en el servicio/guard/controller que los necesite. No vuelvas a crear un wrapper local.

```typescript
import { DispositivoService, TokenService } from '@andestec/api-dispositivos';

@Injectable()
export class MiServicio {
  constructor(
    private readonly dispositivoService: DispositivoService,
    private readonly tokenService: TokenService,
  ) {}
}
```

---

## 2. Módulo a importar — `DispositivoModule` no es global

`DispositivoModule` (de `@andestec/api-dispositivos`) **no** está marcado `@Global()`. Cualquier módulo de Nest que inyecte `DispositivoService`/`TokenService` debe importarlo explícitamente en su propio `imports:`:

```typescript
import { Module } from '@nestjs/common';
import { DispositivoModule } from '@andestec/api-dispositivos';

@Module({
  imports: [DispositivoModule],
  providers: [MiServicio],
})
export class MiModule {}
```

Olvidar este import produce un `UnknownDependenciesException` en el arranque de Nest.

---

## 3. Métodos disponibles (PascalCase — así los expone el paquete)

| Método | Servicio | Firma | Uso típico |
|---|---|---|---|
| `GetDispositivoId()` | `DispositivoService` | `(): string \| null` | Identidad del dispositivo (env `DISPOSITIVO_ID`) |
| `GetDispositivoAmbiente()` | `DispositivoService` | `(): Promise<string \| null>` | `AmbienteId` vigente (con cache TTL 5 min) |
| `LeerArchivoDispositivoInformacion()` | `DispositivoService` | `(): Promise<DispositivoInformacion \| null>` | Info completa del dispositivo (con cache TTL 5 min, refresco automático) |
| `TokenGen(strControl)` | `TokenService` | `(strControl: string): string \| null` | Genera token M2406 firmado con la clave del dispositivo |
| `TokenVal(token, strControl)` | `TokenService` | `(token: string, strControl: string): Promise<ResultadoTokenVal>` | Valida un token M2406/I2406 entrante |

### Ejemplo — patrón `tokenParaEmpresa` (ya extendido en el código)

```typescript
private tokenParaEmpresa(ctx: IPosContext): string {
  const strControl = String(ctx.EmpKey).trim();
  const token = this.tokenService.TokenGen(strControl);
  if (!token) throw new Error(`No se pudo generar token para strControl=${strControl}`);
  return token;
}
```

### Tipado de `LeerArchivoDispositivoInformacion()`

El tipo `DispositivoInformacion` que exporta el paquete es deliberadamente abierto (`{ AmbienteId?: string; [campo: string]: unknown }`), porque la librería no conoce el contrato real del SDT de GeneXus. Si tu código necesita los campos reales (`DispositivoId`, `EnEmpresa`, etc.), castea al tipo local `SDTDispositivoInformacion` (`src/common/interfaces/device.interfaces.ts`):

```typescript
import type { SDTDispositivoInformacion } from '.../common/interfaces/device.interfaces.js';

const info = (await this.dispositivoService.LeerArchivoDispositivoInformacion()) as SDTDispositivoInformacion | null;
```

---

## 4. Salud / frescura de un dato persistido — usar `PersistenciaCheck`

**Prohibido** reintroducir parseo de timestamps XML locales o exponer host/puerto de Redis a mano para chequear si un dato está "fresco" (eso es lo que se purgó junto con el facade). Si el frontend necesita verificar vigencia de un dato del dispositivo, el contrato correcto es `PersistenciaCheck` de `@andestec/persistencia-redis`, leyendo directamente el "sobre" que Redis guarda:

```typescript
import { PersistenciaCheck } from '@andestec/persistencia-redis';

const { ok, ultimaModificacion } = await PersistenciaCheck('Dispositivos', `Informacion${dispositivoId}`);
```

`ultimaModificacion` es un `Date | null` — no un string XML que haya que parsear a mano.

---

## 5. Endpoints de diagnóstico

`DeviceController` (`src/modules/device/device.controller.ts`, montado por `DeviceModule` en `AppModule`) sigue existiendo solo para pruebas manuales rápidas:

- `GET /device/id` → `{ ok, dispositivoId }`
- `GET /device/token` → `{ ok, dispositivoId, token }`
- `GET /device/info` → `{ ok, dispositivoId, informacion }`

Estos endpoints inyectan `DispositivoService`/`TokenService` directamente — son un ejemplo mínimo del patrón de este documento, no una capa a la que otros módulos deban apuntar.
