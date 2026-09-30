# SACI — Aplicación Móvil (apk-saci)

Aplicación móvil del **Sistema Automatizado de Control de Inventarios usando QR**.
Construida con **Expo / React Native**, permite a los operarios de almacén registrar
**entradas y salidas de producto escaneando etiquetas QR reutilizables**, incluso
**sin conexión** (offline-first con SQLite y sincronización por lotes).

Repositorios relacionados:

| Repositorio | Descripción |
|---|---|
| [`api-saci`](https://github.com/rlarquing/api-saci) | API NestJS + MongoDB (kardex, etiquetas, stock, registro diario) |
| [`web-saci`](https://github.com/rlarquing/web-saci) | Panel web Next.js (dashboard BI, productos, movimientos, alertas) |
| [`docs-saci`](https://github.com/rlarquing/docs-saci) | Documentación del sistema (visión, modelo, reglas, contratos) |

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura](#️-arquitectura)
- [Instalación](#-instalación)
- [Configuración de la URL del API](#-configuración-de-la-url-del-api)
- [Despliegue](#-despliegue)
- [Estructura de Archivos](#-estructura-de-archivos)
- [Integración con el API](#-integración-con-el-api)
- [Estado Offline](#-estado-offline)
- [Roles y permisos](#-roles-y-permisos)
- [Scripts](#-scripts)
- [Tech Stack](#-tech-stack)

---

## 📱 Características

- **Escaneo QR de etiquetas reutilizables**: cada etiqueta (`QR-XXXXXX`) representa
  un producto y pasa por el ciclo `disponible → asignado (anulable)`. No es un
  ticket de un solo uso: admite entradas y salidas mientras no esté anulada.
- **Registro manual por SKU**: alternativamente al escaneo, se puede teclear/
  escanear un SKU `PRD-XXXXXX` (resuelto contra el catálogo local).
- **Captura de cantidad**: paso intermedio tras escanear para indicar las
  unidades que entran o salen (0.01–999999.99, teclado decimal).
- **Validación previa de stock**: en salidas, la cantidad se valida contra el
  stock cacheado antes de llamar al API (que además lo valida con el kardex real).
- **Resumen del día**: entradas/salidas en unidades y detalle por categoría,
  con alertas de productos por debajo del stock mínimo.
- **Sincronización por lotes**: los movimientos offline se envían en un solo
  `POST /api/sync` (el API procesa ítem por ítem y reporta errores por ítem).
- **Auto-sync**: al recuperar conexión, al abrir la app ya conectado, al volver
  al dashboard y manualmente desde Configuración (con candado anti-concurrencia).
- **Login offline**: credenciales cacheadas con hash local para operar sin
  servidor; sesión persistente con auto-refresh de tokens.
- **Panel de administración** (solo ADMIN): gestión de caché por tabla, URL del
  API y reseteo de la aplicación.

---

## 🏗️ Arquitectura

Clean Architecture con cuatro capas. Las dependencias apuntan siempre hacia
adentro (dominio sin dependencias de framework):

```
app/                  → Pantallas (Expo Router)
components/           → Componentes UI (QRScanner, CantidadModal, ResultModal)
src/
├── domain/           → Entidades, interfaces de repositorios y use cases
│   ├── entities/     → Movimiento, QR, Producto, StockItem, Almacen, Usuario…
│   ├── repositories/ → Contratos (MovimientoRepository, SyncRepository…)
│   └── usecases/     → RegistrarEntrada/Salida, Sincronizar, ObtenerResumen…
├── data/             → Implementaciones: DTOs, mappers, datasources, repos
│   ├── dtos/         → Contratos HTTP con el API (alineados a api-saci)
│   ├── mappers/      → DTO ↔ Entidad
│   ├── datasources/  → local (SQLite) y remote (HTTP)
│   └── repositories/ → Implementaciones de los contratos del dominio
├── infrastructure/   → SQLite (expo-sqlite), red (fetch + auto-refresh), DI
├── presentation/     → AuthContext + hooks (useOperacionInventario, useSync…)
└── shared/           → Colores de marca y utilidades
```

Flujo de una operación: `Pantalla → hook → Use Case → Repository →
DataSource (remote con fallback local)` — toda operación queda registrada en
el ledger SQLite de inmediato, online u offline.

---

## 🚀 Instalación

Prerrequisitos: **Node 20+**, **npm/npx** (o `bun`), cuenta de **Expo** y para
builds nativos **EAS CLI** + JDK 17.

```bash
npm install
cp .env.example .env       # configurar EXPO_PUBLIC_API_URL
npx expo start
```

> La app necesita `expo-sqlite` y `@react-native-community/netinfo`, que ya
> están en las dependencias. Para probar en dispositivo físico, use
> **Expo Go** o un development build.

---

## 🔧 Configuración de la URL del API

El cliente HTTP usa `EXPO_PUBLIC_API_URL` (build time) y la URL guardada en
Configuración (runtime, prioridad al arrancar). La base puede incluir o no el
segmento `/api`; el cliente evita duplicarlo.

| Origen | Prioridad |
|---|---|
| URL guardada en la app (SQLite `configuracion.api_url`) | 1 (mayor) |
| `EXPO_PUBLIC_API_URL` (.env / eas.json) | 2 |

> **HTTP claro**: `usesCleartextTraffic: true` está habilitado para servidores
> de pruebas sin TLS. En producción use HTTPS.

---

## 📦 Despliegue

Build de APK de pruebas (perfil `preview` de `eas.json`, firma local):

```bash
eas build -p android --profile preview     # build-apk
```

1. Edite `eas.json` y ponga la URL real del API en
   `build.preview.android.env.EXPO_PUBLIC_API_URL`.
2. (Opcional) `eas init` para regenerar `extra.eas.projectId` con su proyecto
   de Expo.
3. Verificación post-despliegue: login, escaneo de etiqueta, entrada offline
   (modo avión) y posterior sincronización.

---

## 📂 Estructura de Archivos

```
apk-saci/
├── app/                    # Rutas Expo Router
│   ├── (main)/             # Área autenticada: dashboard, escáner, perfil
│   ├── login.tsx           # Login (online-first con fallback offline)
│   ├── select-almacen.tsx  # Selección de almacén de trabajo
│   ├── settings.tsx        # Configuración (URL del API + sync manual)
│   ├── admin.tsx           # Panel de administración (solo ADMIN)
│   └── forgot-password.tsx # Recuperación de contraseña en 2 pasos
├── components/             # QRScanner, CantidadModal, ResultModal
├── src/                    # Clean Architecture (ver Arquitectura)
├── plugins/                # Plugins Expo (ABIs, splash sólido, firma local)
├── assets/                 # Iconos y splash (marca SACI)
└── eas.json                # Perfiles de build (APK preview / AAB producción)
```

---

## 🔌 Integración con el API

Endpoints consumidos por la app (prefijo global `/api`):

| Endpoint | Método | Uso |
|---|---|---|
| `/api/auth/signin` | POST | Login (`{userName, password}`) → tokens + `almacenes` + `roles` |
| `/api/auth/refresh-tokens` | POST | Auto-refresh en 401 (Bearer del access viejo + `{refreshToken}`) |
| `/api/auth/logout` | POST | Cierre de sesión |
| `/api/auth/request/reset/password` | PATCH | Código de recuperación por correo |
| `/api/auth/reset/password` | PATCH | Restablecer contraseña con código |
| `/api/auth/change/password` | PATCH | Cambio de contraseña propia |
| `/api/qr/validar?codigo=&almacen_id=` | GET | Validación de etiqueta (`puede_entrada/puede_salida`) |
| `/api/qr/?page=&limit=` | GET | Catálogo de etiquetas (sync, purge + replace) |
| `/api/movimiento-inventario/entrada` | POST | Registrar entrada (`qrCodigo|productoId, almacenId, cantidad`) |
| `/api/movimiento-inventario/salida` | POST | Registrar salida (valida stock suficiente) |
| `/api/movimiento-inventario/stock` | GET | Stock derivado por producto/almacén |
| `/api/registro-diario/actual/:almacenId` | GET | Resumen del día (totalEntradas/totalSalidas/detalleCategorias) |
| `/api/producto?sinPaginacion=true` | GET | Catálogo de productos (SKU `PRD-XXXXXX`) |
| `/api/nomenclador/almacen/listado/elementos` | GET | Catálogo de almacenes |
| `/api/nomenclador/categoria/create/select` | GET | Categorías livianas (`{value,label}`) |
| `/api/sync` | POST | **Lote** de movimientos pendientes + catálogos en la respuesta |
| `/api/sync/status` | GET | Estado de sincronización (informativo) |
| `/api/health` | GET | Health-check para el indicador de conexión |

Notas de contrato:

- La mutación devuelve `ResponseDto { id, successStatus, message }`.
- El `POST /api/sync` exige `movimientosPendientes` **no vacío** y solo acepta
  `entrada|salida`: con la lista vacía la app refresca catálogos por GETs.
- El `ValidationPipe` del API rechaza campos extra (`forbidNonWhitelisted`):
  los requests llevan exactamente los campos declarados.
- El refresh de token exige conservar el access expirado en el header Bearer.

---

## 📲 Estado Offline

- **Ledger local (SQLite)**: cada entrada/salida se guarda al instante con id
  temporal `local-...` y flag `sincronizado=0`; la UI nunca espera al servidor.
- **Pendientes en cola** (`movimientos_pendientes`) con contadores de
  reintentos: máximo 5 intentos antes de descartar (purga).
- **Caches de catálogos**: etiquetas, productos, stock, categorías y almacenes
  se purgan y reemplazan en cada sincronización.
- **Validación offline de etiquetas**: el cache guarda etiquetas `disponible`
  y `asignado` (activas); las anuladas se purgan.
- **Actualización optimista**: tras una entrada exitosa, la etiqueta pasa a
  `asignado` en el cache local para que la próxima validación offline lo sepa.
- **Fechas reales**: los movimientos offline estampan su fecha al crearse y la
  preservan en el sync (el API rechaza fechas > 7 días de antigüedad).
- **Purga automática** en cada sync: pendientes sincronizados > 7 días,
  ledger > 30 días, pendientes con reintentos excedidos, credenciales > 90 días.

---

## 🔐 Roles y permisos

Alineados con `RolType` del API:

| Rol | Acceso a la app |
|---|---|
| `OPERARIO` | Operación completa del escáner (entradas/salidas) y sync |
| `JEFE_DE_ALMACEN` | Ídem operario (ajustes y traslados se gestionan en la web) |
| `ADMINISTRADOR` | Ídem + Panel de Administración (caché, URL del API, reseteo) |

El scoping por almacén lo aplica el servidor con `user.almacenIds`
(el ADMIN lo ve todo); la app respeta la lista de `almacenesAsignados`
que llega en el login.

---

## 📝 Notas

- La cantidad es obligatoria en toda operación: el API define rango
  0.01–999999.99 y el modal valida antes de enviar.
- El stock **nunca** se calcula en el teléfono: se descarga del API (valor
  derivado del kardex). El dato local solo alimenta alertas y pre-validación.
- El `GET /api/qr` no llena `links` en la paginación: el loop usa `meta.totalPages`.
- Ajustes (`AJUSTE`) y traslados (`TRASLADO`) son operaciones del panel web:
  el sync móvil solo cubre `entrada|salida` por diseño del API.

---

## 🛠️ Scripts

| Script | Descripción |
|---|---|
| `npm start` | Arranca Expo (modo offline del CLI) |
| `npm run android` / `ios` / `web` | Lanza en la plataforma correspondiente |
| `npm run build-apk` | `eas build -p android --profile preview` (APK) |
| `npm run build-apk-local` | Prebuild local + `gradlew assembleRelease` |
| `npm run prebuild` | `expo prebuild --no-install -p android` |
| `npm run clear` | Arranca Expo limpiando caché |

---

## 🧱 Tech Stack

- **React Native 0.86** + **Expo SDK 57** + **React 19**
- **TypeScript 6** (strict)
- **expo-router** (navegación por ficheros, typed routes)
- **expo-sqlite** (ledger y caches offline)
- **expo-camera** (escáner QR)
- **@react-native-async-storage/async-storage** (tokens)
- **@react-native-community/netinfo** (detección de red)
- **expo-splash-screen / expo-build-properties** y plugins propios de build
