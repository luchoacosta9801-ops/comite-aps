# 🚜 Comité APS · Riopaila Agrícola

Aplicación web del Comité APS: renovación y siembra de caña y arroz por zona, hacienda y suerte.
No necesita instalación ni servidor de base de datos: los datos se guardan en el navegador.

## Cómo abrirla

- **Rápido:** doble clic en `index.html`.
- **Como aplicación instalable / sin internet:** clic derecho en `servidor.ps1` → *Ejecutar con PowerShell*.
  Se abre `http://localhost:8080`; en Chrome o Edge usa el ícono *Instalar* de la barra de direcciones.
- **En línea:** activa GitHub Pages en el repositorio (Settings → Pages → rama `main`, carpeta raíz).

## Uso semanal

1. **📥 Importar Excel**: arrastra el libro del comité. Se leen las hojas
   `COMITE APS` (encabezado en la fila 5), `RUTA DE SIEMBRA` y `RUTA SEMANA PASADA`.
   Las columnas se reconocen por nombre (Suerte, Hacienda, Zona, Área, Cultivo, Días lucro,
   Estado, Ppto, Variedad, Labor, Contratista, Observación…). Antes de aplicar se muestra
   qué se encontró en cada hoja.
2. Actualiza fecha y semana (en la importación, o con clic en los chips del encabezado).
3. **✏️ Gestionar datos** para ajustes a mano: suertes, ruta, suertes en proceso, presupuesto y costos.
4. **💾 Respaldo**: descarga el Excel o un respaldo `.json` (para pasar los datos a otro computador).

> Los datos viven en el navegador donde se editan. Si cambias de computador o de navegador,
> usa *Descargar respaldo* → *Restaurar respaldo*.

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura del dashboard |
| `css/styles.css` | Estilos |
| `js/data.js` | Datos iniciales (semana 37) y catálogos (haciendas, labores, variedades) |
| `js/store.js` | Guardado local, respaldo JSON y exportación a Excel |
| `js/importer.js` | Lectura del Excel semanal |
| `js/app.js` | Cálculos, gráficos, filtros y buscador |
| `js/gestion.js` | Ventana *Gestionar datos* |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | App instalable y uso sin internet |
| `servidor.ps1` | Servidor local en PowerShell |
| `Comité APS · Dashboard Ejecutivo.html` | Versión original de un solo archivo (referencia) |
