# Comité APS · Riopaila Agrícola
- Presupuesto total 2026: 555.45 ha (% vs ppto = sembradas / 555.45)
- Fuente: hoja COMITE APS (header fila 5), RUTA DE SIEMBRA, RUTA SEMANA PASADA
- Una suerte puede aparecer dos veces (ej. antes arroz sembrada, ahora caña pendiente); son registros distintos
- Cada suerte en proceso pertenece a UNA sola labor (columna LABOR); nunca sumar en varias
- Donut y KPI caña/arroz usan solo área sembrada
- Zona 1: La Luisa, Lagunas, Riopaila, Paila Arriba, La Paila
- Interfaz en español, fondo claro, logo de Riopaila Agrícola (img/logo-riopaila.png) en el encabezado; íconos de app en img/icono-192.png y img/icono-512.png
## App
- App web estática sin build: `index.html` + `js/` (scripts clásicos, no módulos, para que funcione con doble clic desde file://)
- Datos iniciales en `js/data.js`; estado real en localStorage (`comite-aps:v1`), todo cambio pasa por `save()` y `renderAll()`
- Importación Excel en `js/importer.js` (SheetJS desde cdnjs, carga diferida); columnas por nombre normalizado
- Servidor local: `servidor.ps1` (no hay Python ni Node en esta máquina)
- `Comité APS · Dashboard Ejecutivo.html` es la versión original; no editarla
- Publicar SIEMPRE con `publicar.ps1 "mensaje"`: sube la versión (?v=N en index.html y sw.js, meta app-version, version.json), commit y push a main y gh-pages
- Las pestañas abiertas consultan version.json cada 5 min y al volver a la pestaña; si cambió, recargan solas
- El Excel del comité va en `_privado/` (ignorado por git); nunca subirlo
- Edición en localhost/file, o en Pages si el navegador activó ?editor=<clave> (hash en store.js, clave en _privado/clave-editor.txt); para el resto Pages es solo lectura y siempre muestra SEED
- Publicar desde Pages llama a http://localhost:8080/api/publicar (servidor.ps1 permite ese origen por CORS)
- Datos publicados en js/datos.js (generado por "Publicar para todos" vía POST /api/publicar de servidor.ps1, protegido con cabecera X-Comite y Origin)
- Datos nuevos: importar el .xlsm en la app (localhost) y "Publicar"; fecha/semana salen del nombre del archivo (la fecha de RESUMEN es =HOY())
- procesoAnterior = RUTA SEMANA PASADA del comité anterior (torta comparativa); se rota sola al importar una semana nueva
- Simulador de costos (botón 💰 Simulador, #simulador): js/simulador.js + js/sim-datos.js (base copiada de Documents/Simulador Costos Suertes). Estado en DB.sim {tarifas, ppto, labores, planes{suerte: [...]}}; se publica en datos.js. Costo $/ha = pases × tarifa (o cant×tarifa/área si la unidad no es HA); Total $ = $/ha × área

## Para cada sesión
- Responder SIEMPRE en español (también los avisos de progreso). Usuario: Luis Acosta, Esp. de Ingeniería Agrícola (no programador: explicar en lenguaje simple)
- Antes de publicar, revisar `git log` por si el usuario publicó cambios de datos desde la app; no pisarlos
- La actualización semanal la puede hacer el usuario solo (Editar → Importar Excel → Publicar); conservar observaciones escritas en la app si el Excel viene vacío

## Portal de Ingeniería (hecho el 5 oct 2026, js/portal.js)
- Convertir la página en portal "Ingeniería Agrícola · Riopaila Agrícola" (logo + firma) con botones a módulos:
  📊 Dashboard Comité APS (lo actual, sin cambios) · 💰 Simulador (lo actual) ·
  👥 Estructura del área (organigrama editable en pantalla; nombres y cargos pueden ser públicos; no hay Excel fuente) ·
  📅 Presupuesto APS 2027 (estructura lista, sin datos aún; no hay archivo todavía)
- Mismo enlace de GitHub Pages; cada módulo con su dirección (#aps, #simulador, #estructura, #ppto2027)
- Reutilizar modo editor, Publicar, actualización automática, vista celular, Excel y firma. No romper lo que existe
- Navegación: irA(vista) pone body[data-vista] (portal|aps|simulador|estructura|ppto) y la dirección; sin dirección abre la portada. CSS muestra solo el módulo activo
- Datos nuevos publicados en datos.js: DB.estructura {personas[{id,nombre,cargo,equipo,zona,funciones,reportaA}]} y DB.ppto2027 {z1[12],z2[12],labores[{labor,cant,costo}]}
- Pendiente: llenar el organigrama (lo hace el usuario en pantalla) y cargar datos del Presupuesto 2027 cuando exista el archivo
- Estructura cargada desde "Documents/ESTRUCTURA INGENIERIA AGRICOLA/...xlsx": SOLO nombre y cargo (nunca cédula, RH, ciudad, teléfono, estudio: la página es pública). DB.estructura.procesos = hoja "Procesos y Responsables I.A."
- Presupuesto 2027 cargado de "Documents/PROTOCOLO LABORES/RENOVACION PPTO 2027 5 oct.xlsx", hoja Riopaila (DB.ppto2027.suertes)
- Pendiente: portada con video/GIF (MP4 <8 MB, sin sonido, en bucle) guardado como archivo aparte vía servidor.ps1 (no en datos.js); hoy la foto va en DB.portada.imagen (JPEG reducido)
