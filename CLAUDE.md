# Comité APS · Riopaila Agrícola
- Presupuesto total 2026: 555.45 ha (% vs ppto = sembradas / 555.45)
- Fuente: hoja COMITE APS (header fila 5), RUTA DE SIEMBRA, RUTA SEMANA PASADA
- Una suerte puede aparecer dos veces (ej. antes arroz sembrada, ahora caña pendiente); son registros distintos
- Cada suerte en proceso pertenece a UNA sola labor (columna LABOR); nunca sumar en varias
- Donut y KPI caña/arroz usan solo área sembrada
- Zona 1: La Luisa, Lagunas, Riopaila, Paila Arriba, La Paila
- Interfaz en español, fondo claro, ícono 🚜
## App
- App web estática sin build: `index.html` + `js/` (scripts clásicos, no módulos, para que funcione con doble clic desde file://)
- Datos iniciales en `js/data.js`; estado real en localStorage (`comite-aps:v1`), todo cambio pasa por `save()` y `renderAll()`
- Importación Excel en `js/importer.js` (SheetJS desde cdnjs, carga diferida); columnas por nombre normalizado
- Servidor local: `servidor.ps1` (no hay Python ni Node en esta máquina)
- `Comité APS · Dashboard Ejecutivo.html` es la versión original; no editarla
- Publicar SIEMPRE con `publicar.ps1 "mensaje"`: sube la versión (?v=N en index.html y sw.js, meta app-version, version.json), commit y push a main y gh-pages
- Las pestañas abiertas consultan version.json cada 5 min y al volver a la pestaña; si cambió, recargan solas
- Datos nuevos: leer el .xlsm con el importador, pasar el resultado a SEED en js/data.js y cambiar meta.corte (así los navegadores descartan lo guardado)
- El Excel del comité va en `_privado/` (ignorado por git); nunca subirlo
