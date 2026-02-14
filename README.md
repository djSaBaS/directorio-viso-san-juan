# Directorio comunitario · El Viso de San Juan 📌

Autor: **Juan Antonio Sánchez Plaza** a.k.a. **SaBaS**

Este proyecto es un **directorio comunitario** de teléfonos, direcciones y contactos de interés para **El Viso de San Juan (Toledo) y zona**, creado para la comunidad de WhatsApp **“Vecinos del Viso de San Juan”**.

La web incluye:
- Buscador rápido (por nombre, teléfono, dirección, email, etc.)
- Filtro por categorías
- Tarjetas con acciones directas:
  - 📞 Llamar (tel:)
  - ✉️ Email (mailto:)
  - 🧭 Cómo llegar (Google Maps)
  - ⚠️ Reportar dato incorrecto (Google Form pre-rellenado)

## Tecnologías y arquitectura

- **Frontend estático** (HTML/CSS/JS) pensado para **GitHub Pages**.
- Los datos se consumen desde un **endpoint JSON público** (idealmente generado desde **Google Sheets** mediante Apps Script).
- Los reportes de incidencias se envían a **Google Forms**, con campos pre-rellenados usando parámetros `entry.<id>`.

Google Maps “cómo llegar” se construye con URLs del tipo `maps/dir/?api=1&destination=...`.  
Google Forms permite links pre-rellenados con `entry.<id>=valor`.

## Cómo desplegar en GitHub Pages

1) Crea un repositorio en GitHub y sube estos archivos:
- `index.html`
- `styles.css`
- `app.js`

2) Ve a **Settings → Pages**  
- Source: `Deploy from a branch`
- Branch: `main` / `/ (root)`

3) Configura `app.js`:
- `CONFIG.directoryJsonUrl`: URL pública que devuelve el JSON del directorio
- `CONFIG.generalReportFormUrl`: URL del Google Form general (altas/cambios)
- `CONFIG.prefilledIssueFormBaseUrl`: URL base del Google Form pre-rellenado
- `CONFIG.prefilledEntryIds`: IDs `entry` de los campos del Form

## Estructura recomendada del Google Sheet

Hoja: `Telefonos`

Columnas sugeridas:
- `categoria`
- `nombre`
- `telefono`
- `direccion`
- `email`
- `web`
- `horario`
- `notas`
- `activo` (TRUE/FALSE)

## Transporte público (autobuses): ¿se puede añadir?

Sí. Recomendación:
- Crea una segunda hoja `Autobuses` con:
  - `linea`
  - `parada`
  - `direccion_parada`
  - `horarios`
  - `dias`
  - `notas`
  - `maps` (opcional)

Luego hay 2 formas:
1) Integrarlo como una categoría más (“Transporte”) dentro del mismo endpoint JSON.
2) Exponer un segundo endpoint JSON y añadir una pestaña/sección “Autobuses” en la web.

## Licencia

Uso comunitario. Si vas a reutilizarlo para otro municipio, por favor conserva el crédito.
