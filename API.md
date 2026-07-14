# AndesPOS Middleware — API Reference

Base URL: `http://localhost:3000` (desarrollo) — configurable via `PORT`.

CORS habilitado para `http://localhost:5173` (Vite/React). No se requieren headers de autenticación desde el frontend; el middleware genera el ApiKey internamente.

---

## Convenciones

- Todos los endpoints retornan JSON.
- El campo `ok: boolean` siempre está presente y es el primer chequeo a hacer.
- El interceptor global aplana wrappers SDT de GeneXus: los campos que venían dentro de `SDTParametrosValuesApp`, `SDTParametroEstructura`, etc. quedan en el nivel raíz del objeto `resultado`.
- Los parámetros con `?` son opcionales.

---

## Módulo: Session

### `GET /session/context`

Punto de entrada recomendado. Devuelve el contexto unificado que el frontend necesita para iniciar sesión: empresa, ambiente, token y configuración del servidor GeneXus.

**Sin parámetros.**

**Respuesta exitosa:**
```json
{
  "Contexto": {
    "EmpKey": 1,
    "Ambiente": "PRD",
    "TokenSeguridad": "abc123...",
    "Configuracion": {
      "hostname": "servidor.empresa.com",
      "port": 80,
      "basePath": "/MiApp/Api/ObtencionParametros",
      "secure": false,
      "timeout": 30000
    }
  }
}
```

**Error (dispositivo no disponible):** HTTP 500 con mensaje descriptivo.

---

## Módulo: Parameter

### `GET /parameter/values`

Obtiene los valores de parámetros de aplicación. Usa caché de 5 minutos (archivo local). El `AmbienteId` se obtiene automáticamente del dispositivo si no se envía.

**Query params:**

| Param       | Tipo   | Requerido | Descripción                          |
|-------------|--------|-----------|--------------------------------------|
| `app`       | string | No        | Identificador de la aplicación (`Aplicacion_Idl`) |
| `alcance`   | string | No        | `AlcanceId` — filtra por alcance     |
| `parametro` | string | No        | `ParametroId` — filtra por un parámetro específico |
| `empkey`    | number | No        | Clave de empresa                     |

> **Sin caché:** cada llamada consulta GeneXus directamente y actualiza el archivo de persistencia local. Los valores siempre están frescos.

**Ejemplos:**

```
# Todos los parámetros de una app
GET /parameter/values?app=MIAPP&alcance=GLOBAL

# Un parámetro específico
GET /parameter/values?app=MIAPP&alcance=GLOBAL&parametro=TIMEOUT_SESION

# Con empresa
GET /parameter/values?app=MIAPP&alcance=GLOBAL&empkey=1
```

**Respuesta exitosa:**
```json
{
  "ok": true,
  "resultado": {
    "Ok": true,
    "Messages": [],
    "ParametrosValuesApp": [
      {
        "ParametroId": "EDITAPRECIO",
        "ParametroJerarquia": "3",
        "Persistencia": "SESION",
        "ValorInstanciado": true,
        "ValorJerarquia": "01 APLICACION",
        "ValorParametroIni": "2023-07-11T14:44:21",
        "ValorParametroFin": "2099-12-31T23:59:59",
        "ValorParametroValor": "true"
      }
    ]
  }
}
```

> **Campos del array `ParametrosValuesApp`:**
> | Campo | Tipo | Descripción |
> |-------|------|-------------|
> | `ParametroId` | string | Identificador del parámetro |
> | `ValorParametroValor` | string | **Valor actual del parámetro** |
> | `ValorParametroIni` | string | Fecha de inicio de vigencia (ISO 8601) |
> | `ValorParametroFin` | string | Fecha de fin de vigencia (ISO 8601) |
> | `ValorInstanciado` | boolean | `true` si tiene valor asignado; `false` si no aplica |
> | `ValorJerarquia` | string | Nivel donde se definió el valor (`01 APLICACION`, `02 EMPRESA`, etc.) |
> | `Persistencia` | string | Tipo de persistencia GeneXus (`SESION`, `SIEMPRE`, `CACHE`, `NUNCA`, o vacío) |
> | `ParametroJerarquia` | string | Nivel jerárquico del parámetro |

**Respuesta fallida:**
```json
{
  "ok": false,
  "resultado": {
    "Ok": false,
    "Messages": [
      { "Id": "E001", "Type": 2, "Description": "Parámetro no encontrado" }
    ],
    "ParametrosValuesApp": []
  }
}
```

---

### `GET /parameter/definitions`

Obtiene las definiciones (metadatos) de los parámetros de una aplicación. Usa caché de 5 minutos.

**Query params:**

| Param  | Tipo   | Requerido | Descripción                   |
|--------|--------|-----------|-------------------------------|
| `app`  | string | **Sí**    | Identificador de la aplicación |
| `modo` | string | No        | Modo de consulta (opcional)   |

**Ejemplo:**
```
GET /parameter/definitions?app=MIAPP
```

**Respuesta exitosa:**
```json
{
  "ok": true,
  "resultado": {
    "Ok": true,
    "Messages": [],
    "ParametrosDefinitionApp": [
      {
        "ParametroId": "TIMEOUT_SESION",
        "ParametroNombre": "Timeout de Sesión",
        "ParametroDescripcion": "Minutos de inactividad antes de cerrar sesión",
        "ParametroTipo": "N"
      }
    ]
  }
}
```

**Error si falta `app`:**
```json
{
  "ok": false,
  "error": "Falta query param ?app=APP_IDL"
}
```

---

### `GET /parameter/structures`

Obtiene la lista de estructuras de parámetros disponibles en GeneXus.

**Sin parámetros.**

**Ejemplo:**
```
GET /parameter/structures
```

**Respuesta exitosa:**
```json
{
  "ok": true,
  "resultado": {
    "Ok": true,
    "Messages": [],
    "ParametroEstructura": [
      {
        "EstructuraId": "EST001",
        "EstructuraNombre": "Configuración General",
        "EstructuraDescripcion": "Parámetros de configuración global"
      }
    ]
  }
}
```

---

### `GET /parameter/config`

Devuelve la configuración leída del archivo `parms202501.xml` del dispositivo. Útil para diagnóstico.

**Sin parámetros.**

**Respuesta:**
```json
{
  "ok": true,
  "configuracion": {
    "hostname": "servidor.empresa.com",
    "port": 80,
    "basePath": "/MiApp/Api/ObtencionParametros",
    "secure": false,
    "timeout": 30000
  },
  "pathConfig": "C:/Users/Public/Enternet2411/Dispositivo/DATA/AppConfig/parms202501.xml"
}
```

---

## Módulo: Device

### `GET /device/info`

Devuelve la información completa del dispositivo registrado. Usa caché de 5 minutos.

**Sin parámetros.**

**Respuesta:**
```json
{
  "ok": true,
  "dispositivoId": "DISP-001",
  "informacion": {
    "DispositivoId": "DISP-001",
    "EmpKey": 1,
    "AmbienteId": "PRD",
    "DispositivoNombre": "Caja 1",
    "SucursalId": "SUC01",
    "SucursalNombre": "Sucursal Centro",
    "PuntoVentaId": "PV01",
    "PuntoVentaNombre": "Punto de Venta 1"
  }
}
```

---

### `GET /device/id`

Devuelve el ID del dispositivo desencriptado desde `DispInfo.txt`. Útil para diagnóstico.

**Sin parámetros.**

**Respuesta:**
```json
{
  "ok": true,
  "dispositivoId": "DISP-001",
  "pathDispositivo": "C:/Users/Public/Enternet2411/Dispositivo/DATA/AppConfig/DispInfo.txt"
}
```

---

### `GET /device/token`

Genera y devuelve el token de seguridad actual. Útil para diagnóstico.

**Sin parámetros.**

**Respuesta:**
```json
{
  "ok": true,
  "dispositivoId": "DISP-001",
  "token": "HMAC_TOKEN_AQUI",
  "timestamp": "20250421112031"
}
```

---

## Flujo recomendado desde el frontend

```
1. GET /session/context
   → guardar EmpKey, Ambiente, TokenSeguridad

2. GET /parameter/values?app=MIAPP&alcance=GLOBAL
   → obtener todos los valores de parámetros del ambiente

3. Filtrar en el frontend el parámetro que se necesite de ParametrosValuesApp[]
```

Si se necesita un único parámetro puntual y se quiere evitar traer todo:
```
GET /parameter/values?app=MIAPP&alcance=GLOBAL&parametro=NOMBRE_PARAMETRO
```

---

## Manejo de errores frecuentes

| Situación | `ok` | Qué revisar |
|-----------|------|-------------|
| `ok: false` con `Messages` | `false` | Ver `Messages[].Description` para el mensaje de GeneXus |
| HTTP 500 | — | El dispositivo no está configurado o el archivo `DispInfo.txt` / `parms202501.xml` no existe |
| Respuesta con datos distintos a GeneXus | `true` | Verificar que `app` + `alcance` + `AmbienteId` del dispositivo sean los correctos |
| CORS error | — | Verificar que el frontend corre en `http://localhost:5173`; si el puerto es distinto, ajustar `CORS_ORIGIN` en el middleware |
