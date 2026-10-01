# 🚜 Comité APS · Riopaila Agrícola

Dashboard del Comité APS: renovación y siembra de caña y arroz por zona, hacienda y suerte.

- **Página para todos (solo lectura):** https://luchoacosta9801-ops.github.io/comite-aps/
  Se puede filtrar, buscar, plegar cuadros y **descargar en Excel**. No se puede editar.
- **Edición (solo el administrador):** en el link público, tras abrir una vez el enlace de `_privado/clave-editor.txt` en tu navegador; o en tu PC con `servidor.ps1` (clic derecho → *Ejecutar con PowerShell*).
  Aparecen **✏️ Gestionar datos** y **🚀 Publicar para todos** (publicar siempre requiere `servidor.ps1` abierto en tu PC).

## Actualización semanal

1. Abre la app con `servidor.ps1`.
2. **✏️ Gestionar datos → 📥 Importar Excel semanal** y arrastra el libro del comité
   (ej. `30092026 - Comite APS.xlsm`). La fecha y la semana salen del nombre del archivo; las
   labores de la semana que termina pasan a ser la "semana anterior" del comparativo.
3. Revisa el dashboard y pulsa **🚀 Publicar para todos**. En 1–2 minutos todos ven la versión
   nueva; las pestañas que estén abiertas se actualizan solas.

Mientras no publiques, los cambios solo se ven en tu PC (el botón *Gestionar datos* muestra ●).

## Qué lee del Excel

| Hoja | Uso |
|---|---|
| COMITE APS (encabezado en fila 5) | Lotes. Suerte = `sect-sue`; sembrada si *Área Siemb* tiene hectáreas (pendiente = "X") |
| RUTA DE SIEMBRA | Ruta vigente |
| RUTA SEMANA PASADA | Suertes en proceso, una sola labor por suerte (columna LABOR) |
| RESUMEN | Presupuesto total (columna PPTO en la fila TOTAL) |
| PANEL CONTROL | Costos de preparación |

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html`, `css/styles.css` | Página y estilos |
| `js/datos.js` | **Datos publicados** (lo genera *Publicar para todos*) |
| `js/data.js` | Catálogos: haciendas, labores, variedades, colores |
| `js/store.js` | Modo edición, guardado local, respaldo y publicación |
| `js/importer.js` | Lectura del Excel semanal |
| `js/app.js` | Cálculos, gráficos, comparativo, filtros, cuadros plegables, actualización automática |
| `js/exportar.js` | Descarga en Excel |
| `js/simulador.js`, `js/sim-datos.js` | Simulador de costos por suerte en proceso (botón 💰 Simulador) y sus tarifas/presupuesto base |
| `js/gestion.js` | Ventana *Gestionar datos* y *Publicar* |
| `servidor.ps1` | Servidor local con la edición y la publicación |
| `publicar.ps1` | Sube la versión y publica en GitHub Pages (lo usa el servidor) |
| `sw.js`, `manifest.webmanifest`, `img/`, `version.json` | App instalable, sin internet y actualización automática |
| `_privado/` | Copias de los Excel del comité (no se suben a GitHub) |
