# Guía de Routing hacia GeneXus — AndesPOS Middleware

> **Leer antes de crear o modificar cualquier llamada a GenexusClientService.**
> Errores de `target` envían el request al host incorrecto y producen 404 silenciosos.

---

## 1. Los dos backends de GeneXus

| Target | Parámetro en código | Host en producción | Base path | Cómo se resuelve |
|--------|--------------------|--------------------|-----------|-----------------|
| **admin** | `'admin'` (default) | `nod16.enternet.cl:443` | `/AdministradorDispositivos202406/Dispositivos/WebService/` | Lee `LocationAdministradorDispositivos.txt` en disco |
| **pos** | `'pos'` | `196.162.56.18` | Configurado en `GX_POS_BASE_URL` (`.env`) | Variable de entorno `GX_POS_BASE_URL` |

> **`'admin'` es el default cuando no se pasa `options`.** Si omites el cuarto argumento de `request()`, el request va a `nod16` — que es el host equivocado para todos los endpoints de negocio POS.

---

## 2. Regla de clasificación de endpoints

### `target: 'admin'` — Solo para operaciones de dispositivo

Usar **únicamente** para endpoints del módulo `device` (registro, clave, configuración de dispositivo físico).

```
APIDispositivos/GetDispositivoClave
APIDispositivos/RegistrarDispositivo
APIDispositivos/...
```

### `target: 'pos'` — Todos los endpoints de negocio POS

Usar para **todos** los demás endpoints: ventas, precios, sesión, y cualquier módulo de negocio futuro.

```
APIVentas/GetListaVentas          ← legacy pero vive en POS
APIVentas/CrearVenta              ← legacy pero vive en POS
APIVentas/AnularVenta             ← legacy pero vive en POS
APIVentas/GetDetalleVenta         ← legacy pero vive en POS

POS/AI_API/Venta/xVenta/GetEstadoCaja
POS/AI_API/Venta/xVenta/GetListaVentas
POS/AI_API/Venta/xVenta/CrearNuevaVenta
POS/AI_API/Venta/xVenta/AnularVenta

POS/AI_API/Precios/xListaDePrecios/...   (cuando se implemente)
```

---

## 3. Cómo usar GenexusClientService correctamente

```typescript
// ✅ CORRECTO — endpoint de negocio POS
this.genexusClient.request<T>(
  'APIVentas/CrearVenta',
  { ...payload },
  'POST',
  { target: 'pos' },   // ← siempre explícito para endpoints POS
);

// ✅ CORRECTO — endpoint de dispositivo (admin)
this.genexusClient.request<T>(
  'APIDispositivos/GetDispositivoClave',
  { ...payload },
  'GET',
  // target 'admin' es el default — puede omitirse aquí intencionalmente
);

// ❌ INCORRECTO — omitir target en endpoint POS
this.genexusClient.request<T>(
  'APIVentas/CrearVenta',
  { ...payload },
  'POST',
  // Sin options → va a nod16 → 404
);
```

---

## 4. Constantes de rutas en VentasService

```typescript
// APIs legacy — todas usan { target: 'pos' }
private static readonly GX = {
  LISTA:   'APIVentas/GetListaVentas',
  CREAR:   'APIVentas/CrearVenta',
  ANULAR:  'APIVentas/AnularVenta',
  DETALLE: 'APIVentas/GetDetalleVenta',
} as const;

// Nueva API xVenta — todas usan { target: 'pos' }
private static readonly GX_XVENTA = {
  ESTADO_CAJA:  'POS/AI_API/Venta/xVenta/GetEstadoCaja',
  LISTA_VENTAS: 'POS/AI_API/Venta/xVenta/GetListaVentas',
  CREAR_NUEVA:  'POS/AI_API/Venta/xVenta/CrearNuevaVenta',
  ANULAR:       'POS/AI_API/Venta/xVenta/AnularVenta',
} as const;
```

---

## 5. Variables de entorno requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `GX_POS_BASE_URL` | Base URL completa del backend POS | `http://196.162.56.18:8080/AndesPOS_API2602N` |
| `CORS_ORIGIN` | Origen del frontend React | `http://localhost:5173` |
| `PORT` | Puerto del middleware | `3000` |

El archivo `LocationAdministradorDispositivos.txt` (solo para `target: 'admin'`) vive en:
- **Windows:** `C:\Program Files\Apache Software Foundation\Tomcat 8.5\webapps\DATA\Dispositivo24\`
- **Linux:** `/opt/Dispositivo/DATA/Dispositivo24/`

Formato del archivo: `host;port;baseUrl;timeoutSegundos;secure(0|1)`

---

## 6. Especificaciones OpenAPI disponibles

Los YAML en `docs/` describen los contratos de la nueva API xVenta. Consultar antes de implementar un endpoint nuevo.

| Archivo | Objeto GeneXus | Endpoints |
|---------|---------------|-----------|
| [POS.AI_API.Venta.xVenta.yaml](./POS.AI_API.Venta.xVenta.yaml) | `xVenta` | `GetEstadoCaja`, `GetListaVentas`, `CrearNuevaVenta` |
| [POS.AI_API.Precios.xListaDePrecios.yaml](./POS.AI_API.Precios.xListaDePrecios.yaml) | `xListaDePrecios` | _(ver archivo)_ |

> Los endpoints legacy (`APIVentas/`) **no tienen YAML**. Su contrato está implícito en las interfaces TypeScript de `ventas.interfaces.ts`.

---

## 7. Resumen de regla mnemotécnica

```
¿El endpoint empieza con APIDispositivos/?  →  target: 'admin'  (o sin options)
Todo lo demás                               →  target: 'pos'    (siempre explícito)
```
