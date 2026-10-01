// Descarga en Excel de todo lo que muestra el dashboard (respeta los filtros activos).

const r2 = n => Math.round((+n || 0) * 100) / 100;
const FIRMA = 'Luis Acosta · Esp. de Ingeniería Agrícola';

function textoFiltros(){
  const nombres = {zona:'Zona',hac:'Hacienda',cult:'Cultivo',est:'Estado',ppto:'Presupuesto',dias:'Días lucro'};
  const activos = Object.entries(F).filter(([,v]) => v !== 'all')
    .map(([k]) => `${nombres[k]}: ${q(SELS[k]).options[q(SELS[k]).selectedIndex].text}`);
  return activos.length ? activos.join(' · ') : 'Sin filtros (todos los lotes)';
}

// Cada hoja termina con la firma de quien elabora el informe
function hoja(XLSX, filas, anchos){
  const ws = XLSX.utils.aoa_to_sheet([...filas, [], [`Elaborado por: ${FIRMA}`]]);
  ws['!cols'] = anchos.map(w => ({ wch: w }));
  return ws;
}

function resumenZona(data){
  const zs = arr => {
    const a = sum(arr, l => l.a), s = sum(arr.filter(l => l.e === 'SEMBRADA'), l => l.a);
    return [r2(sum(arr.filter(l => l.c === 'CAÑA'), l => l.a)), r2(sum(arr.filter(l => l.c === 'ARROZ'), l => l.a)),
            r2(s), r2(a - s), r2(a), a > 0 ? r2(s / a * 100) : 0];
  };
  return [['Zona 1', ...zs(data.filter(l => l.z === 1))], ['Zona 2', ...zs(data.filter(l => l.z === 2))], ['TOTAL', ...zs(data)]];
}

function exportarExcel(){
  cargarXLSX().then(XLSX => {
    const data = filtered(), wb = XLSX.utils.book_new();
    const semb = data.filter(l => l.e === 'SEMBRADA'), tot = sum(data, l => l.a), s = sum(semb, l => l.a);
    const { fecha, semana, pptoTotal } = DB.meta;

    // RESUMEN
    XLSX.utils.book_append_sheet(wb, hoja(XLSX, [
      ['Comité APS · Riopaila Agrícola'],
      [`Elaborado por: ${FIRMA}`],
      [`Datos al ${fecha} · ${semana}`],
      [`Filtros: ${textoFiltros()}`],
      [],
      ['INDICADOR', 'VALOR'],
      ['Lotes', data.length],
      ['Área APS (ha)', r2(tot)],
      ['Sembradas (ha)', r2(s)],
      ['Pendientes (ha)', r2(tot - s)],
      ['% sembrado del área APS', tot > 0 ? r2(s / tot * 100) : 0],
      ['Presupuesto total (ha)', r2(pptoTotal)],
      ['% vs presupuesto', pptoTotal > 0 ? r2(s / pptoTotal * 100) : 0],
      ['Días lucro promedio', data.length ? Math.round(sum(data, l => l.d) / data.length) : 0],
      ['Caña sembrada (ha)', r2(sum(semb.filter(l => l.c === 'CAÑA'), l => l.a))],
      ['Arroz sembrado (ha)', r2(sum(semb.filter(l => l.c === 'ARROZ'), l => l.a))],
      ['En presupuesto (ha)', r2(sum(data.filter(l => l.p === 'SI'), l => l.a))],
      ['Fuera de presupuesto (ha)', r2(sum(data.filter(l => l.p === 'NO'), l => l.a))],
      [],
      ['ZONA', 'CAÑA (ha)', 'ARROZ (ha)', 'SEMBRADO (ha)', 'PENDIENTE (ha)', 'TOTAL (ha)', '% AVANCE'],
      ...resumenZona(data),
    ], [30, 14, 12, 14, 15, 12, 11]), 'RESUMEN');

    // HACIENDAS
    const hacs = hacsActuales().map(h => {
      const hd = data.filter(l => l.h === h), a = sum(hd, l => l.a), hs = sum(hd.filter(l => l.e === 'SEMBRADA'), l => l.a);
      return [h, hd.length, r2(a), r2(hs), r2(a - hs), a > 0 ? r2(hs / a * 100) : 0];
    }).filter(r => r[1] > 0);
    XLSX.utils.book_append_sheet(wb, hoja(XLSX,
      [['HACIENDA', 'LOTES', 'ÁREA (ha)', 'SEMBRADO (ha)', 'PENDIENTE (ha)', '% AVANCE'], ...hacs],
      [16, 8, 11, 14, 15, 10]), 'HACIENDAS');

    // LOTES
    XLSX.utils.book_append_sheet(wb, hoja(XLSX,
      [['SUERTE', 'HACIENDA', 'ZONA', 'ÁREA APS (ha)', 'CULTIVO', 'DÍAS LUCRO', 'ESTADO', 'PPTO 2026', 'VARIEDAD'],
       ...data.map(l => [l.s, l.h, l.z, r2(l.a), l.c, l.d, l.e, l.p, l.v])],
      [11, 14, 6, 13, 9, 11, 11, 10, 13]), 'LOTES');

    // RUTA DE SIEMBRA
    XLSX.utils.book_append_sheet(wb, hoja(XLSX,
      [['ORDEN', 'HACIENDA', 'SUERTE', 'ÁREA (ha)', 'DÍAS LUCRO', 'VARIEDAD', 'SEMILLERO', 'BANDEREO (m)', 'CONTRATISTA'],
       ...DB.ruta.map((r, i) => ({ r, i })).filter(({ r }) => !fueraDeFiltro(r.h, zonaDe(r.h))).map(({ r, i }) => [i + 1, r.h, r.s, r2(r.a), r.d, r.variedad || '', r.semillero || '', r.bandereo || '', r.cont || ''])],
      [7, 14, 11, 10, 11, 22, 20, 17, 13]), 'RUTA DE SIEMBRA');

    // LABORES (suertes en proceso)
    XLSX.utils.book_append_sheet(wb, hoja(XLSX,
      [['LABOR', 'HACIENDA', 'SUERTE', 'ZONA', 'ÁREA (ha)', 'DÍAS LUCRO', 'CONTRATISTA', 'OBSERVACIÓN', 'VARIEDAD'],
       ...procesoFiltrado().map(r => [r.labor, r.hac, r.sue, r.z, r2(r.area), r.dias, r.cont || '', r.obs || '', r.variedad || ''])],
      [12, 14, 11, 6, 10, 11, 13, 22, 13]), 'SUERTES EN PROCESO');

    // COMPARATIVO DE LABORES
    const comp = comparativoLabores();
    if (comp) {
      XLSX.utils.book_append_sheet(wb, hoja(XLSX, [
        [`Comparativo de labores · ${comp.antes.semana} (${comp.antes.fecha}) vs ${comp.ahora.semana} (${comp.ahora.fecha})`],
        [],
        ['LABOR', `${comp.antes.semana} (ha)`, `${comp.antes.semana} (suertes)`, `${comp.ahora.semana} (ha)`, `${comp.ahora.semana} (suertes)`, 'DIFERENCIA (ha)'],
        ...comp.filas.map(f => [f.lab, r2(f.a0), f.n0, r2(f.a1), f.n1, r2(f.a1 - f.a0)]),
        ['TOTAL', r2(comp.tot0), sum(comp.filas, f => f.n0), r2(comp.tot1), sum(comp.filas, f => f.n1), r2(comp.tot1 - comp.tot0)],
      ], [14, 16, 18, 16, 18, 16]), 'COMPARATIVO LABORES');
    }

    // SIMULADOR DE COSTOS (suertes en proceso)
    if (typeof filasSimulador === 'function') {
      XLSX.utils.book_append_sheet(wb, hoja(XLSX,
        [['SUERTE', 'HACIENDA', 'ÁREA (ha)', 'LABOR', 'ESTADO', 'CONTRATISTA', 'PASES', 'TARIFA $', 'COSTO $/ha', 'PPTO $/ha', 'DIFERENCIA $/ha', 'COSTO TOTAL $'],
         ...filasSimulador()],
        [11, 13, 10, 13, 10, 30, 7, 11, 12, 12, 15, 14]), 'SIMULADOR COSTOS');
    }

    // PPTO 2026
    const { z1, z2 } = DB.pptoMensual, zt = z1.map((v, i) => v + (z2[i] || 0));
    XLSX.utils.book_append_sheet(wb, hoja(XLSX, [
      ['ZONA', ...MESES, 'TOTAL'],
      ['ZONA 1', ...z1.map(r2), r2(sum(z1))],
      ['ZONA 2', ...z2.map(r2), r2(sum(z2))],
      ['TOTAL', ...zt.map(r2), r2(sum(zt))],
    ], [9, ...MESES.map(() => 8), 9]), 'PPTO 2026');

    // COSTOS
    const c = DB.costos;
    XLSX.utils.book_append_sheet(wb, hoja(XLSX, [
      ['CONCEPTO', '$/ha REAL', '$/ha PPTO', 'COSTO TOTAL $'],
      ...c.map(x => [x.concepto, Math.round(x.real), x.ppto ? Math.round(x.ppto) : '', Math.round(x.total)]),
      ['TOTAL', Math.round(sum(c, x => x.real)), c.find(x => x.ppto)?.ppto ? Math.round(c.find(x => x.ppto).ppto) : '', Math.round(sum(c, x => x.total))],
    ], [14, 13, 13, 16]), 'COSTOS');

    wb.Props = { Title: `Comité APS · ${semana}`, Subject: 'Renovación y siembra · Riopaila Agrícola', Author: FIRMA, Company: 'Riopaila Agrícola S.A.', CreatedDate: new Date() };
    XLSX.writeFile(wb, `Comite-APS-${slugSemana()}${data.length !== DB.lotes.length ? '-filtrado' : ''}.xlsx`);
    toast('✓ Excel descargado');
  }).catch(e => toast('⚠ ' + e.message));
}
