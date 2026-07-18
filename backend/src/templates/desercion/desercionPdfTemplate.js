'use strict';

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const ASSETS_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'assets');

function readImageAsBase64(filename) {
  try {
    const filePath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    const ext = path.extname(filename).slice(1).toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' : null;
    if (!mime) return null;
    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

function getNivel(value) {
  if (value >= 75) return 'Cr\u00edtico';
  if (value >= 50) return 'Alto';
  if (value >= 25) return 'Medio';
  return 'Bajo';
}

function riskColor(nivel) {
  const map = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', 'Cr\u00edtico': '#ef4444' };
  return map[nivel] || '#64748b';
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pctOf(value, total) {
  const t = Math.max(1, toNum(total, 1));
  return Math.min(100, Math.max(0, (toNum(value, 0) / t) * 100));
}

function formatDate(d) {
  return d.toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

class DesercionPdfTemplate {

  async generate(data, user) {
    const generatedAt = new Date();
    const generatedBy = user
      ? [user.nombres, user.apellido_paterno, user.apellido_materno].filter(Boolean).join(' ').trim()
      : 'Sistema SIVACAD';

    const logo1 = readImageAsBase64('Logo-TecNM.png');
    const logo2 = readImageAsBase64('Logo-TESI.png');
    const watermark = readImageAsBase64('marcadeagua_SIVACAD.jpeg');

    const html = this.buildHtml(data, generatedAt, generatedBy, logo1, logo2, watermark);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '25mm', right: '18mm', bottom: '22mm', left: '18mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `
          <div style="width:100%;font-size:7px;font-family:Arial,sans-serif;color:#94a3b8;
               text-align:center;padding:4px 18mm 0 18mm;border-top:1px solid #e2e8f0;">
            SIVACAD &mdash; Sistema Integral para la Valoraci&oacute;n del Conocimiento
            y Aprovechamiento Acad&eacute;mico &nbsp;|&nbsp;
            P&aacute;gina <span class="pageNumber"></span> de <span class="totalPages"></span>
            &nbsp;|&nbsp; CONFIDENCIAL &mdash; Uso Acad&eacute;mico Exclusivo
          </div>
        `
      });
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  buildHtml(data, generatedAt, generatedBy, logo1, logo2, watermark) {
    const periodo = data.periodo_activo || 'N/D';
    const r = data.resumen || {};
    const dist = data.distribucion_riesgo || [];
    const parciales = data.parciales || [];
    const ciclos = data.ciclos || [];
    const porCarrera = data.por_carrera || [];
    const progresion = data.progresion || [];
    const alertas = data.alertas_recientes || [];
    const insights = data.insights || [];
    const totalDist = dist.reduce((s, d) => s + toNum(d.total), 0);
    const porMateria = data.por_materia || [];

    const wmBg = watermark
      ? `background-image:url('${watermark}');background-repeat:no-repeat;
         background-position:center;background-size:cover;opacity:0.04;`
      : '';

    return '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<style>\n'
      + '*{box-sizing:border-box;margin:0;padding:0}'
      + 'body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:9px;line-height:1.55;background:#fff}'
      + '@page{margin:0;size:A4}'
      + '.page{position:relative;width:210mm;min-height:297mm;padding:25mm 18mm 22mm;page-break-after:always}'
      + '.page:last-child{page-break-after:auto}'
      + '.watermark{position:fixed;top:0;left:0;width:210mm;height:297mm;pointer-events:none;z-index:-1;' + wmBg + '}'
      + '.content{position:relative;z-index:1}'
      + '.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:6mm;margin-bottom:5mm;border-bottom:2.5px solid #4f46e5}'
      + '.header-logo{height:38px;object-fit:contain}'
      + '.header-center{text-align:center;flex:1}'
      + '.header-center h1{font-size:13px;color:#0f172a;margin-bottom:2px;letter-spacing:.3px}'
      + '.header-center .sub{font-size:7px;color:#64748b}'
      + '.header-center .sub strong{color:#4f46e5}'
      + '.header-badge{display:inline-block;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:1px 7px;border-radius:3px;font-size:6.5px;font-weight:700;margin-top:2px}'
      + '.section-title{font-size:11px;font-weight:700;color:#0f172a;margin:4mm 0 1.5mm;padding-bottom:1.5mm;border-bottom:2px solid #4f46e5;page-break-after:avoid}'
      + '.paragraph{text-align:justify;margin-bottom:2mm;color:#334155;line-height:1.6}'
      + '.cards{display:flex;flex-wrap:wrap;gap:3.5mm;margin-bottom:3mm}'
      + '.card{flex:0 0 calc(33.333% - 2.5mm);background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:2.5mm 2mm;text-align:center;page-break-inside:avoid}'
      + '.card-label{font-size:6.5px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px}'
      + '.card-value{font-size:16px;font-weight:700}'
      + '.dist-container{display:flex;gap:4mm;margin-bottom:3mm;align-items:flex-start}'
      + '.dist-chart{flex:0 0 40%}'
      + '.dist-legend{flex:0 0 58%}'
      + '.dist-legend-item{display:flex;align-items:center;gap:2mm;margin-bottom:1mm;font-size:8px;color:#334155}'
      + '.dist-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}'
      + '.dist-bar-container{margin-top:2mm}'
      + '.dist-bar-row{display:flex;align-items:center;gap:2mm;margin-bottom:1.5mm}'
      + '.dist-bar-label{width:35px;font-size:7px;font-weight:600;text-align:right}'
      + '.dist-bar-track{flex:1;height:14px;background:#f1f5f9;border-radius:3px;overflow:hidden}'
      + '.dist-bar-fill{height:100%;border-radius:3px;min-width:3px}'
      + '.dist-bar-val{width:30px;font-size:7px;font-weight:700;text-align:right}'
      + '.table-wrap{width:100%;overflow-x:auto;margin-bottom:3mm;page-break-inside:avoid}'
      + 'table{width:100%;border-collapse:collapse;font-size:7.5px}'
      + 'thead th{background:#4f46e5;color:#fff;font-weight:600;text-align:left;padding:2mm 1.5mm;white-space:nowrap;font-size:7px}'
      + 'thead th:not(:first-child){text-align:center}'
      + 'tbody td{padding:1.5mm 1.5mm;border-bottom:1px solid #e2e8f0;color:#334155}'
      + 'tbody td:not(:first-child){text-align:center}'
      + 'tbody tr:nth-child(even){background:#f8fafc}'
      + '.insight-item{display:flex;gap:2mm;margin-bottom:1.5mm;text-align:justify;page-break-inside:avoid}'
      + '.insight-num{flex:0 0 16px;height:16px;background:#4f46e5;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;margin-top:1px}'
      + '.insight-text{flex:1;font-size:8px;color:#334155;line-height:1.55;display:block;width:100%;min-width:600px;white-space:normal;word-break:break-word}'
      + '.prog-row{display:flex;align-items:center;gap:2mm;margin-bottom:1mm}'
      + '.prog-label{width:40px;font-size:6.5px;color:#64748b}'
      + '.prog-track{flex:1;height:12px;display:flex;border-radius:2px;overflow:hidden}'
      + '.prog-seg{height:100%;min-width:1px}'
      + '.footer-note{margin-top:4mm;padding-top:2mm;border-top:1px solid #e2e8f0;font-size:6.5px;color:#94a3b8;text-align:center;line-height:1.5}'
      + '.flex-between{display:flex;justify-content:space-between;align-items:center}'
      + '.tag-riesgo{padding:.3mm 1.5mm;border-radius:2px;font-size:6.5px;font-weight:600;color:#fff;display:inline-block}'
      + '.badge{display:inline-block;padding:.5mm 2mm;border-radius:2px;font-size:6.5px;font-weight:600;color:#fff}'
      + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.page{break-inside:avoid}'
      + '.section-title,.insight-item,.card,.table-wrap{page-break-inside:avoid !important;break-inside:avoid !important}}'
      + '</style>\n</head>\n<body>\n'
      + '<div class="watermark"></div>\n'
      + '<div class="page"><div class="content">\n'

      // HEADER
      + '<div class="header">'
      + (logo1 ? '<img class="header-logo" src="' + logo1 + '" alt="TecNM"/>' : '<div style="width:38px"></div>')
      + '<div class="header-center">'
      + '<h1>SIVACAD &mdash; Reporte Estrat\u00e9gico de Riesgo de Deserci\u00f3n</h1>'
      + '<div class="sub">Generado por: <strong>' + generatedBy + '</strong> &nbsp;|&nbsp; '
      + formatDate(generatedAt) + ' &nbsp;|&nbsp; Periodo: <strong>' + periodo + '</strong></div>'
      + '<div class="header-badge">CONFIDENCIAL &mdash; Uso Acad\u00e9mico Exclusivo</div>'
      + '</div>'
      + (logo2 ? '<img class="header-logo" src="' + logo2 + '" alt="TESI"/>' : '<div style="width:38px"></div>')
      + '</div>\n'

      // SECTION 1: EXECUTIVE SUMMARY
      + '<div class="section-title">1. Resumen Ejecutivo</div>\n'
      + '<p class="paragraph">El presente reporte estrat\u00e9gico consolida el an\u00e1lisis de riesgo '
      + 'acad\u00e9mico del per\u00edodo <strong>' + periodo + '</strong>. El sistema SIVACAD tiene registrados '
      + '<strong>' + toNum(r.alumnos) + '</strong> alumnos, <strong>' + toNum(r.docentes) + '</strong> docentes '
      + 'y <strong>' + toNum(r.grupos) + '</strong> grupos bajo cobertura institucional. Se han generado '
      + '<strong>' + toNum(r.alertas_total) + '</strong> alertas de deserci\u00f3n, de las cuales '
      + '<strong>' + toNum(r.alertas_pendientes) + '</strong> est\u00e1n pendientes de atenci\u00f3n y '
      + '<strong>' + toNum(r.alertas_atendidas) + '</strong> han sido atendidas, lo que representa una '
      + 'tasa de atenci\u00f3n del <strong>' + toNum(r.tasa_atencion) + '%</strong>.</p>\n'

      // CARDS
      + '<div class="cards">'
      + this._card('Alertas Totales', toNum(r.alertas_total), '#4f46e5')
      + this._card('Pendientes', toNum(r.alertas_pendientes), '#f97316')
      + this._card('Atendidas', toNum(r.alertas_atendidas), '#16a34a')
      + this._card('Tasa de Atenci\u00f3n', toNum(r.tasa_atencion) + '%', toNum(r.tasa_atencion) >= 50 ? '#16a34a' : '#dc2626')
      + this._card('Alumnos Registrados', toNum(r.alumnos), '#3b82f6')
      + this._card('Grupos Activos', toNum(r.grupos), '#8b5cf6')
      + '</div>\n'

      // SECTION 2: RISK DISTRIBUTION
      + '<div class="section-title">2. Distribuci\u00f3n de Riesgo Acad\u00e9mico</div>\n'
      + '<div class="dist-container">'
      + '<div class="dist-chart">'
      + '<svg viewBox="0 0 200 200" style="width:160px;height:160px;margin:0 auto;display:block;">'
      + '<circle cx="100" cy="100" r="90" fill="#f1f5f9"/>'
      + this._donutSvg(dist, 100, 100, 90)
      + '<circle cx="100" cy="100" r="40" fill="#fff"/>'
      + '</svg></div>'
      + '<div class="dist-legend">'
      + '<p class="paragraph" style="margin-bottom:1.5mm">La distribuci\u00f3n de riesgo entre los '
      + '<strong>' + totalDist + '</strong> casos analizados muestra que el <strong>'
      + pctOf(dist.filter(function(d){return d.nivel==='Cr\u00edtico'||d.nivel==='Alto'}).reduce(function(s,d){return s+toNum(d.total)},0), totalDist).toFixed(1)
      + '%</strong> de los casos se concentra en niveles Alto o Cr\u00edtico.</p>'
      + dist.map(function(d){return '<div class="dist-legend-item"><div class="dist-dot" style="background:'+riskColor(d.nivel)+'"></div><span><strong>'+d.nivel+':</strong> '+toNum(d.total)+' casos ('+pctOf(toNum(d.total),totalDist).toFixed(1)+'%)</span><span style="font-size:6.5px;color:#94a3b8;margin-left:auto">'+(d.nivel==='Cr\u00edtico'?'Acci\u00f3n inmediata':d.nivel==='Alto'?'Intervenci\u00f3n prioritaria':d.nivel==='Medio'?'Seguimiento preventivo':'Riesgo controlado')+'</span></div>'}).join('')
      + '</div></div>'
      + '<div class="dist-bar-container">'
      + dist.map(function(d){return '<div class="dist-bar-row"><div class="dist-bar-label" style="color:'+riskColor(d.nivel)+'">'+d.nivel+'</div><div class="dist-bar-track"><div class="dist-bar-fill" style="width:'+pctOf(toNum(d.total),totalDist)+'%;background:'+riskColor(d.nivel)+'"></div></div><div class="dist-bar-val">'+toNum(d.total)+'</div></div>'}).join('')
      + '</div>\n'

      // SECTION 3: PARCIALES
      + (parciales.length > 0 ? (
      '<div class="section-title">3. An\u00e1lisis por Parciales Acad\u00e9micos</div>\n'
      + '<p class="paragraph">El an\u00e1lisis por parciales acad\u00e9micos permite identificar '
      + 'tendencias tempranas de deserci\u00f3n y evaluar el impacto de las intervenciones '
      + 'pedag\u00f3gicas implementadas durante el ciclo escolar <strong>' + periodo + '</strong>.</p>\n'
      + '<div class="table-wrap"><table><thead><tr>'
      + '<th>Parcial</th><th>Promedio</th><th>Riesgos</th><th>Reprob.</th><th>Afect.</th><th>Activos</th><th>Desert.</th><th>Tasa Deser.</th>'
      + '</tr></thead><tbody>'
      + parciales.map(function(p){return '<tr><td>Parcial '+p.numero_parcial+'</td><td>'+toNum(p.promedio_general)+'</td><td>'+toNum(p.total_riesgos)+'</td><td>'+toNum(p.total_reprobadas)+'</td><td>'+toNum(p.alumnos_afectados)+'</td><td>'+toNum(p.total_activos)+'</td><td>'+toNum(p.total_desertores)+'</td><td><span class="tag-riesgo" style="background:'+riskColor(getNivel(p.tasa_desercion))+'">'+toNum(p.tasa_desercion)+'%</span></td></tr>'}).join('')
      + '</tbody></table></div>\n'
      + parciales.map(function(p){return '<div class="flex-between" style="margin-bottom:0.5mm;padding:1mm;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3px;"><div style="font-weight:600;font-size:8px;color:#0f172a;width:70px;flex-shrink:0">Parcial '+p.numero_parcial+':</div><div style="font-size:7.5px;color:#334155;text-align:justify;flex:1">Promedio general de <strong>'+toNum(p.promedio_general)+'</strong> con <strong>'+toNum(p.total_riesgos)+'</strong> eventos de riesgo. De <strong>'+toNum(p.total_alumnos)+'</strong> alumnos, <strong style="color:#16a34a">'+toNum(p.total_activos)+'</strong> activos y <strong style="color:#dc2626">'+toNum(p.total_desertores)+'</strong> desertores ('+toNum(p.tasa_desercion)+'% &mdash; nivel <strong style="color:'+riskColor(getNivel(p.tasa_desercion))+'">'+getNivel(p.tasa_desercion)+'</strong>).'+(p.numero_parcial===1?' Primer corte cr\u00edtico para intervenciones tempranas.':p.numero_parcial===3?' Parcial final que consolida el panorama del ciclo.':' Parcial intermedio para evaluar intervenciones.')+'</div></div>'}).join('')
      ) : '')

      // SECTION 4: CYCLE COMPARISON
      + (ciclos.length > 1 ? (
      '<div class="section-title">4. Comparativa por Ciclos Escolares</div>\n'
      + '<p class="paragraph">El an\u00e1lisis comparativo hist\u00f3rico por ciclos escolares permite '
      + 'a la Direcci\u00f3n Acad\u00e9mica evaluar la evoluci\u00f3n de la deserci\u00f3n estudiantil '
      + 'a lo largo del tiempo.</p>\n'
      + '<div class="table-wrap"><table><thead><tr>'
      + '<th>Ciclo</th><th>Alertas</th><th>Alto/Cr\u00edtico</th><th>Riesgo Prom.</th><th>Total Alumnos</th><th>Tasa Deser.</th>'
      + '</tr></thead><tbody>'
      + ciclos.map(function(c){return '<tr><td>'+c.ciclo+'</td><td>'+toNum(c.alertas)+'</td><td>'+toNum(c.alto_riesgo)+'</td><td>'+toNum(c.riesgo_promedio)+'</td><td>'+toNum(c.total_alumnos)+'</td><td><span class="tag-riesgo" style="background:'+riskColor(getNivel(c.tasa_desercion))+'">'+toNum(c.tasa_desercion)+'%</span></td></tr>'}).join('')
      + '</tbody></table></div>\n'
      + ciclos.map(function(c,i){var t=i>0?(toNum(c.alertas)>toNum(ciclos[i-1].alertas)?'incremento':'disminuci\u00f3n'):'inicial';return '<div class="flex-between" style="margin-bottom:0.5mm;padding:0.5mm 1mm;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3px;"><div style="font-weight:600;font-size:7.5px;color:#0f172a;width:65px;flex-shrink:0">'+c.ciclo+':</div><div style="font-size:7px;color:#334155;text-align:justify;flex:1">Se registraron <strong>'+toNum(c.alertas)+'</strong> alertas ('+toNum(c.alto_riesgo)+' alto/cr\u00edtico, riesgo promedio '+toNum(c.riesgo_promedio)+'). Tasa de deserci\u00f3n: <strong>'+toNum(c.tasa_desercion)+'%</strong> sobre '+toNum(c.total_alumnos)+' alumnos.'+(i>0?' Comparado con '+ciclos[i-1].ciclo+': <strong>'+t+'</strong> de '+Math.abs(toNum(c.alertas)-toNum(ciclos[i-1].alertas))+' alertas.':' Ciclo base para comparaci\u00f3n hist\u00f3rica.')+'</div></div>'}).join('')
      ) : '')

      // SECTION 5: INSIGHTS
      + '<div class="section-title">5. Insights Estrat\u00e9gicos</div>\n'
      + '<p class="paragraph">A continuaci\u00f3n se presentan los hallazgos clave del an\u00e1lisis '
      + 'automatizado de deserci\u00f3n, generados mediante el modelo de inteligencia artificial de SIVACAD.</p>\n'
      + (insights.length > 0
        ? insights.map(function(ins,i){return '<div class="insight-item"><div class="insight-num">'+(i+1)+'</div><div class="insight-text">'+ins+'</div></div>'}).join('')
        : '<p class="paragraph" style="color:#94a3b8;text-align:center;">No se generaron insights para el per\u00edodo actual.</p>')

      // SECTION 6: BY CAREER
      + (porCarrera.length > 0 ? (
      '<div class="section-title">6. An\u00e1lisis por Carrera</div>\n'
      + '<p class="paragraph">El desglose por carrera permite identificar las \u00e1reas acad\u00e9micas '
      + 'con mayor incidencia de riesgo de deserci\u00f3n. La carrera de <strong>' + porCarrera[0].carrera
      + '</strong> encabeza la lista con <strong>' + toNum(porCarrera[0].total_alertas)
      + '</strong> alertas, de las cuales <strong>' + toNum(porCarrera[0].alto_riesgo)
      + '</strong> son de nivel Alto o Cr\u00edtico.</p>\n'
      + '<div class="table-wrap"><table><thead><tr><th>Carrera</th><th>Alertas Totales</th><th>Alto/Cr\u00edtico</th><th>Pendientes</th></tr></thead><tbody>'
      + porCarrera.map(function(c){return '<tr><td>'+c.carrera+'</td><td>'+toNum(c.total_alertas)+'</td><td>'+toNum(c.alto_riesgo)+'</td><td>'+toNum(c.pendientes)+'</td></tr>'}).join('')
      + '</tbody></table></div>\n'
      + '<div class="dist-bar-container">'
      + function(){var maxA=Math.max(1,porCarrera.map(function(x){return toNum(x.total_alertas)}));return porCarrera.slice(0,10).map(function(c){return '<div class="dist-bar-row"><div class="dist-bar-label" style="width:auto;min-width:60px;text-align:left;font-size:6.5px">'+c.carrera.substring(0,25)+'</div><div class="dist-bar-track"><div class="dist-bar-fill" style="width:'+(toNum(c.total_alertas)/maxA)*100+'%;background:#0ea5e9"></div></div><div class="dist-bar-val" style="font-size:7px">'+toNum(c.total_alertas)+'</div></div>'}).join('')}()
      + '</div>\n'
      ) : '')

      // SECTION 7: TEMPORAL PROGRESSION
      + (progresion.length > 0 ? (
      '<div class="section-title">7. Progresi\u00f3n Temporal del Riesgo</div>\n'
      + '<p class="paragraph">La evoluci\u00f3n mensual de las alertas de deserci\u00f3n muestra la '
      + 'din\u00e1mica del riesgo a lo largo del per\u00edodo analizado.</p>\n'
      + '<div class="table-wrap"><table><thead><tr><th>Mes</th><th style="color:#22c55e">Bajo</th><th style="color:#eab308">Medio</th><th style="color:#f97316">Alto</th><th style="color:#ef4444">Cr\u00edtico</th><th>Total</th></tr></thead><tbody>'
      + progresion.map(function(p){return '<tr><td>'+p.mes+'</td><td>'+toNum(p.bajo)+'</td><td>'+toNum(p.medio)+'</td><td>'+toNum(p.alto)+'</td><td>'+toNum(p.critico)+'</td><td><strong>'+toNum(p.total)+'</strong></td></tr>'}).join('')
      + '</tbody></table></div>\n'
      + function(){var mp=Math.max(1,progresion.map(function(p){return toNum(p.total)}));return progresion.map(function(p){return '<div class="prog-row"><div class="prog-label">'+p.mes+'</div><div class="prog-track"><div class="prog-seg" style="width:'+(toNum(p.bajo)/mp)*100+'%;background:#22c55e"></div><div class="prog-seg" style="width:'+(toNum(p.medio)/mp)*100+'%;background:#eab308"></div><div class="prog-seg" style="width:'+(toNum(p.alto)/mp)*100+'%;background:#f97316"></div><div class="prog-seg" style="width:'+(toNum(p.critico)/mp)*100+'%;background:#ef4444"></div></div><div style="width:28px;font-size:6.5px;font-weight:700;text-align:right">'+toNum(p.total)+'</div></div>'}).join('')}()
      ) : '')

      // SECTION 8: RECENT ALERTS
      + (alertas.length > 0 ? (
      '<div class="section-title">8. Alertas Recientes</div>\n'
      + '<p class="paragraph">Las siguientes son las alertas de deserci\u00f3n m\u00e1s recientes '
      + 'registradas en el sistema.</p>\n'
      + '<div class="table-wrap"><table><thead><tr><th>#</th><th>Matr\u00edcula</th><th>Alumno</th><th>Riesgo</th><th>Puntaje</th><th>Estado</th><th>Periodo</th></tr></thead><tbody>'
      + alertas.map(function(a,i){return '<tr><td>'+(i+1)+'</td><td>'+(a.matricula||'')+'</td><td>'+(a.nombres||'')+' '+(a.apellido_paterno||'')+' '+(a.apellido_materno||'')+'</td><td><span class="tag-riesgo" style="background:'+riskColor(a.nivel_riesgo)+'">'+(a.nivel_riesgo||'')+'</span></td><td>'+toNum(a.puntaje_riesgo)+'</td><td>'+(a.atendida?'<span class="badge" style="background:#16a34a">Atendida</span>':'<span class="badge" style="background:#f97316">Pendiente</span>')+'</td><td>'+(a.nombre_periodo||'')+'</td></tr>'}).join('')
      + '</tbody></table></div>\n'
      ) : '')

      // SECTION 9: MATERIAS CRITICAS
      + (porMateria.length > 0 ? (
      '<div class="section-title">9. Materias Cr\u00edticas</div>\n'
      + '<p class="paragraph">Las siguientes materias presentan los indicadores m\u00e1s desfavorables '
      + 'en cuanto a promedio general y n\u00famero de reprobados.</p>\n'
      + '<div class="table-wrap"><table><thead><tr><th>Materia</th><th>Alumnos Eval.</th><th>Promedio</th><th>Reprobados</th><th>Nivel</th></tr></thead><tbody>'
      + porMateria.map(function(m){return '<tr><td>'+m.materia+'</td><td>'+toNum(m.alumnos_evaluados)+'</td><td>'+toNum(m.promedio)+'</td><td>'+toNum(m.reprobados)+'</td><td><span class="tag-riesgo" style="background:'+(m.nivel==='Cr\u00edtico'?'#ef4444':m.nivel==='Atenci\u00f3n'?'#f97316':'#22c55e')+'">'+m.nivel+'</span></td></tr>'}).join('')
      + '</tbody></table></div>\n'
      ) : '')

      // FOOTER
      + '<div class="footer-note">'
      + '<strong>SIVACAD</strong> &mdash; Sistema Integral para la Valoraci\u00f3n del Conocimiento '
      + 'y Aprovechamiento Acad\u00e9mico<br>'
      + 'Reporte generado el ' + formatDate(generatedAt) + ' por <strong>' + generatedBy
      + '</strong> &nbsp;|&nbsp; Periodo: ' + periodo + '<br>'
      + '<em>CONFIDENCIAL &mdash; Este documento contiene informaci\u00f3n institucional sensible. '
      + 'Su distribuci\u00f3n no autorizada est\u00e1 prohibida.</em>'
      + '</div>\n'

      + '</div></div>\n'
      + '</body>\n</html>';
  }

  _card(label, value, color) {
    return '<div class="card"><div class="card-label">' + label + '</div>'
      + '<div class="card-value" style="color:' + color + '">' + value + '</div></div>';
  }

  _donutSvg(items, cx, cy, r) {
    if (!items || items.length === 0) return '';
    var total = items.reduce(function(s, i) { return s + toNum(i.total); }, 0) || 1;
    var startAngle = -90;
    var paths = '';
    var toRad = function(deg) { return (deg * Math.PI) / 180; };
    items.forEach(function(item) {
      var val = toNum(item.total);
      if (val <= 0) return;
      var angle = (val / total) * 360;
      var endAngle = startAngle + angle;
      var x1 = cx + r * Math.cos(toRad(startAngle));
      var y1 = cy + r * Math.sin(toRad(startAngle));
      var x2 = cx + r * Math.cos(toRad(endAngle));
      var y2 = cy + r * Math.sin(toRad(endAngle));
      paths += '<path d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1
        + ' A' + r + ',' + r + ' 0 ' + (angle > 180 ? 1 : 0) + ',1 '
        + x2 + ',' + y2 + ' Z" fill="' + riskColor(item.nivel || item.label)
        + '" stroke="#fff" stroke-width="1"/>';
      startAngle = endAngle;
    });
    return paths;
  }
}

module.exports = new DesercionPdfTemplate();
