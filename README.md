# 🅿️ APK-SACI — Sistema Automatizado de Control de Inventarios

Aplicación móvil (Android) para el registro de entrada y salida de vehículos mediante códigos QR.

Forma parte del sistema SACI junto con [api-saci](https://github.com/SACI-DEV/api-saci) (backend) y [web-saci](https://github.com/SACI-DEV/web-saci) (panel de administración).

---

## Tabla de Contenidos

- [Arquitectura](#-arquitectura)
- [Características](#-características)
- [Instalación para desarrollo](#-instalación-para-desarrollo)
- [Configuración de la URL del API](#-configuración-de-la-url-del-api)
- [Despliegue a producción](#-despliegue-a-producción)
- [Estructura de Archivos](#-estructura-de-archivos)
- [Integración con el API](#-integración-con-el-api)
- [Estado Offline](#-estado-offline)
- [Scripts Disponibles](#-scripts-disponibles)
- [Tech Stack](#-tech-stack)

---

## 🏗️ Arquitectura

El proyecto implementa **Clean Architecture** con soporte **offline-first**:

```
src/
├── domain/                # Reglas de negocio (capa más interna)
│   ├── entities/          # Entidades del dominio
│   ├── repositories/      # Interfaces de repositorios
│   └── usecases/          # Casos de uso
├── data/                  # Capa de datos
│   ├── datasources/       # Fuentes de datos (local/remoto)
│   ├── dtos/              # Data Transfer Objects
│   ├── mappers/           # Mapeadores DTO ↔ Entidad
│   └── repositories/      # Implementaciones de repositorios
├── infrastructure/        # Servicios externos
│   ├── database/          # SQLite (expo-sqlite)
│   ├── di/                # Inyección de dependencias (ServiceContainer)
│   └── network/           # Cliente HTTP (fetch + auto-refresh de token)
├── presentation/          # Capa de presentación
│   ├── contexts/          # Contextos React
│   └── hooks/             # Custom hooks
└── shared/                # Utilidades compartidas
```

### Flujo de dependencias

```
presentation → domain ← data ← infrastructure
     ↓           ↑         ↑
   (UI)    (interfaces) (implementaciones)
```

Las capas internas (`domain`) no conocen las externas. Las capas externas implementan las interfaces definidas en `domain`.

---

## 📱 Características

- **Autenticación**: Login con usuario y contraseña (JWT con refresh automático)
- **Selección de Almacen**: Uno o múltiples almacenes asignados
- **Escaneo de QR**: Códigos QR de vehículos con `expo-camera`
- **Registro Entrada/Salida**: Operaciones diferenciadas
- **Resumen en Tiempo Real**: Vehículos dentro, ingresos del día
- **Sincronización Offline**: Operaciones guardadas en SQLite cuando no hay conexión
- **URL del API configurable**: Editable desde la pantalla de ajustes sin recompilar

---

## 🚀 Instalación para desarrollo

### Prerrequisitos

| Componente | Versión |
|---|---|
| **Node.js** | >= 20.x (requisito de Expo SDK 55) |
| **npm** | >= 10.x |
| **EAS CLI** | >= 13.0.0 (`npm install -g eas-cli`) |
| **Cuenta Expo** | Necesaria para builds en la nube |
| **JDK 17 + Android SDK** | Solo para builds locales |

### Pasos

```bash
git clone https://github.com/SACI-DEV/apk-saci.git
cd apk-saci

npm install

# Configurar la URL del API para desarrollo
cp .env.example .env
# Editar EXPO_PUBLIC_API_URL

npm start
```

> `expo-sqlite` y `@react-native-community/netinfo` ya vienen declaradas en `package.json`: `npm install` es suficiente.

---

## 🔧 Configuración de la URL del API

`EXPO_PUBLIC_API_URL` apunta a la **raíz** del backend, sin el sufijo `/api` (el cliente HTTP lo añade y evita duplicarlo si ya viene incluido).

| Origen | Cuándo se aplica | Prioridad |
|---|---|---|
| `.env` → `EXPO_PUBLIC_API_URL` | Desarrollo con `npm start` | Valor por defecto del bundle |
| `eas.json` → `preview.android.env` | Build APK (`--profile preview`) | Valor por defecto del bundle |
| `eas.json` → `production.android.env` | Build AAB (`--profile production`) | Valor por defecto del bundle |
| Pantalla **Ajustes** dentro de la app | En cualquier momento | **Sobrescribe** al valor del bundle y persiste |

Es decir: el valor compilado es solo el **predeterminado**. Cambiarlo para todas las instalaciones nuevas exige recompilar; cambiarlo en un dispositivo concreto se hace desde Ajustes.

> **HTTP en claro:** `app.json` activa `usesCleartextTraffic: true`, necesario porque el API se sirve hoy por `http://`. Si migras el backend a HTTPS, desactívalo para endurecer la app.

---

## 📦 Despliegue a producción

### 1. Preparar la versión

Antes de cada publicación, actualiza `app.json`:

```jsonc
{
  "expo": {
    "version": "1.0.1",      // versión visible al usuario
    "android": {
      "package": "com.saci.parking"
    }
  }
}
```

EAS gestiona automáticamente el `versionCode` de Android (`autoIncrement`) si lo habilitas en el perfil; en caso contrario debes subirlo manualmente en cada envío a Google Play.

### 2. Fijar la URL del API de producción

Editar `eas.json` y confirmar que ambos perfiles apuntan al backend correcto:

```jsonc
{
  "build": {
    "preview":    { "android": { "env": { "EXPO_PUBLIC_API_URL": "https://api.tudominio.com" } } },
    "production": { "android": { "env": { "EXPO_PUBLIC_API_URL": "https://api.tudominio.com" } } }
  }
}
```

### 3. Credenciales de firma

- El perfil **preview** usa `credentialsSource: "local"`: necesita `credentials.json` y `credentials/android/keystore.jks` en la raíz del proyecto. **Ambos están en `.gitignore`** — guárdalos en un gestor de secretos, no en el repositorio. Sin el keystore original no se puede publicar una actualización de la misma app.
- El perfil **production** usa las credenciales gestionadas por EAS (`eas credentials`).

### 4. Generar el artefacto

```bash
# Iniciar sesión una sola vez
eas login

# APK para distribución interna / instalación manual
eas build --platform android --profile preview
# equivalente: npm run build-apk

# AAB para Google Play
eas build --platform android --profile production
```

Build local sin la nube de EAS (requiere Android SDK y JDK 17):

```bash
npm run build-apk-local
# → android/app/build/outputs/apk/release/app-release.apk
```

### 5. Distribuir

- **APK (preview):** EAS devuelve un enlace de descarga. Instalación directa en los dispositivos con "orígenes desconocidos" habilitado.
- **AAB (production):** subir a Google Play Console, o `eas submit --platform android --profile production`.

### 6. Verificación posterior al despliegue

- [ ] La app abre y llega a la pantalla de login
- [ ] Login correcto contra el API de producción
- [ ] Escaneo de QR y registro de entrada/salida
- [ ] Modo avión: la operación se guarda localmente
- [ ] Al recuperar la conexión, la sincronización sube lo pendiente
- [ ] `CORS_ORIGINS` del api-saci no bloquea a la app (las peticiones nativas no envían `Origin`, pero conviene verificarlo si hay proxy de por medio)

---

## 📂 Estructura de Archivos

```
apk-saci/
├── app/                        # Pantallas (expo-router)
│   ├── _layout.tsx             # Layout raíz + AuthProvider
│   ├── index.tsx               # Entrada / redirección
│   ├── login.tsx               # Login
│   ├── forgot-password.tsx     # Recuperación de contraseña
│   ├── select-almacen.tsx      # Selección de almacen
│   ├── settings.tsx            # Configuración (URL del API)
│   ├── admin.tsx               # Opciones de administración
│   └── (main)/                 # Grupo autenticado
│       ├── _layout.tsx
│       ├── index.tsx           # Dashboard principal
│       ├── scanner.tsx         # Escáner QR
│       ├── profile.tsx         # Perfil de usuario
│       └── change-password.tsx # Cambio de contraseña
├── components/                 # OperationButton, QRScanner, ResultModal
├── plugins/                    # Config plugins de Expo (ABI, splash, firma)
├── src/                        # Clean Architecture (ver Arquitectura)
├── assets/
├── app.json                    # Configuración de Expo
└── eas.json                    # Perfiles de build de EAS
```

---

## 🔌 Integración con el API

Cliente HTTP propio sobre `fetch` (`src/infrastructure/network/NetworkService.ts`), con reintento automático ante un `401` mediante refresh token.

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/auth/signin` | POST | Iniciar sesión |
| `/api/auth/refresh-tokens` | POST | Renovar tokens |
| `/api/auth/logout` | POST | Cerrar sesión |
| `/api/auth/change/password` | PATCH | Cambiar contraseña |
| `/api/auth/request/reset/password` | PATCH | Solicitar reset de contraseña |
| `/api/qr/validar` | POST | Validar QR |
| `/api/qr/info` | POST | Información del QR |
| `/api/movimiento/` | POST | Registrar entrada |
| `/api/movimiento/:id` | PATCH | Registrar salida |
| `/api/movimiento/activos` | GET | Vehículos dentro del almacen |
| `/api/movimiento/resumen/:almacenId` | GET | Resumen del día |
| `/api/precio/almacen` | GET | Precios por almacen |
| `/api/sync` | POST | Sincronización offline |
| `/api/sync/status` | GET | Estado de la sincronización |

---

## 📲 Estado Offline

- **Login**: requiere conexión con el API
- **Operaciones**: se guardan en SQLite cuando no hay red
- **Sincronización**: automática al recuperar la conexión, o manual desde la app
- **Precios y QRs**: cacheados localmente para validar sin conexión

---

## 🔐 Roles

- **ADMINISTRADOR**: acceso a cualquier almacen y a la gestión de usuarios
- **JEFE_DE_ALMACEN**: gestiona trabajadores y sus almacenes asignados
- **USUARIO**: solo los almacenes asignados

---

## 📝 Notas

1. **JWT**: el access token se mantiene en memoria; el refresh token se guarda en `AsyncStorage`
2. **Sesión SQLite**: el almacen seleccionado persiste entre arranques
3. **Precios**: se actualizan en cada sincronización

---

## 🛠️ Scripts Disponibles

| Comando | Descripción |
|---|---|
| `npm start` | Servidor de desarrollo de Expo (modo offline) |
| `npm run android` | Abrir en un emulador o dispositivo Android |
| `npm run clear` | Servidor de desarrollo limpiando la caché |
| `npm run prebuild` | Generar el proyecto nativo de Android |
| `npm run build-apk` | APK vía EAS (`--profile preview`) |
| `npm run build-apk-local` | APK compilado localmente con Gradle |
| `npm run build:android` | Build de EAS sin perfil fijo |

---

## 🧱 Tech Stack

- **Framework**: React Native 0.83 + Expo SDK 55
- **Router**: expo-router (basado en archivos)
- **Estado**: React Context + hooks
- **Base de datos local**: expo-sqlite
- **HTTP**: `fetch` nativo con capa propia de reintentos
- **QR**: expo-camera
- **Arquitectura**: Clean Architecture

---

Desarrollado para el Sistema Automatizado de Control de Inventarios (SACI).
