# Assets — Marca SACI

Recursos gráficos de la aplicación. Todos derivan del logo oficial de SACI
(brackets de escaneo QR + caja de inventario) definido en el repo
[`docs-saci/brand/`](https://github.com/rlarquing/docs-saci/tree/master/brand).

## Archivos

| Archivo | Dimensiones | Uso |
|---|---|---|
| `icon.png` | 1024×1024 (RGB opaco) | Icono principal de la app (`app.json → expo.icon`) |
| `adaptive-icon.png` | 1024×1024 (RGBA transparente) | Capa frontal del icono adaptativo Android (`app.json → android.adaptiveIcon.foregroundImage`); el fondo lo pone `backgroundColor: #0F766E` |
| `splash.png` | 720×1080 (RGBA transparente) | Pantalla de carga, glifo blanco centrado; se muestra sobre fondo `#0F766E` (`expo-splash-screen` + `app/_layout.tsx`) |
| `logo.png` | 512×512 (RGB opaco) | Emblem de reserva para pantallas/README |

## Colores de la marca

- **Primario (teal SACI)**: `#0F766E` — fondo de icono, splash y acentos
- **Superficie**: `#FFFFFF` / neutros claros
- El teal de marca es el mismo en toda la plataforma: web-saci, apk-saci y documentación

## Regenerar variantes

Las variantes (favicon, PWA, splash, wordmark horizontal, versión clara/oscura)
se generan desde el master del logo. Ver `docs-saci/brand/README.md` para la
guía de marca completa y las reglas de uso.
