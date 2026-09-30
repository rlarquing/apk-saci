# Assets

Esta carpeta contiene los recursos gráficos de la aplicación.

## Archivos necesarios:

1. **icon.png** (1024x1024)
   - Icono principal de la aplicación
   - Usado para el ícono de la app en el dispositivo

2. **adaptive-icon.png** (1024x1024)
   - Icono adaptativo para Android
   - Debe tener fondo transparente o sólido

3. **splash.png** (1284x2778 recomendado)
   - Imagen de pantalla de carga
   - Se muestra mientras la app carga

4. **favicon.png** (48x48)
   - Icono pequeño para web

## Generar assets automáticamente

Puedes usar herramientas como:
- [Expo Icon Generator](https://buildicon.netlify.app/)
- [App Icon Generator](https://appicon.co/)
- [MakeAppIcon](https://makeappicon.com/)

## Colores de la marca

- **Primary**: #1a1a2e (azul oscuro)
- **Secondary**: #16213e (azul más oscuro)
- **Accent**: #e94560 (rosa/rojo)
- **Success**: #4ade80 (verde)
- **Error**: #ef4444 (rojo)

## Generar desde SVG

Si tienes ImageMagick instalado:

```bash
# Icono principal
convert -background "#1a1a2e" -size 1024x1024 icon.svg icon.png

# Splash
convert -background "#1a1a2e" -size 1284x2778 splash.svg splash.png
```
