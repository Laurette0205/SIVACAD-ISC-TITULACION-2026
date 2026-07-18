'use strict';

const ExcelJS = require('exceljs');

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function riskColor(nivel) {
  const map = { Bajo: 'FF22C55E', Medio: 'FFEAB308', Alto: 'FFF97316', 'Cr\u00edtico': 'FFEF4444' };
  return map[nivel] || 'FF64748B';
}

class DesercionExcel {

  async generate(data, user) {
    const generatedBy = user
      ? [user.nombres, user.apellido_paterno, user.apellido_materno].filter(Boolean).join(' ').trim()
      : 'Sistema SIVACAD';
    const generatedAt = new Date();
    const periodo = data.periodo_activo || 'N/D';
    const r = data.resumen || {};

    const workbook = new ExcelJS.Workbook();
    workbook.creator = generatedBy;
    workbook.company = 'TESI';
    workbook.created = generatedAt;
    workbook.modified = generatedAt;
    workbook.title = 'SIVACAD - Reporte Estrategico de Desercion';
    workbook.subject = 'Analisis de riesgo academico institucional';

    const STYLES = {
      title: { font: { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } } },
      subtitle: { font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } } },
      header: { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } } },
      subheader: { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } } },
      cell: { font: { name: 'Arial', size: 9, color: { argb: 'FF334155' } } },
      number: { font: { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } }, alignment: { horizontal: 'center' } },
      pct: { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }, alignment: { horizontal: 'center' } },
      meta: { font: { name: 'Arial', size: 8, italic: true, color: { argb: 'FF94A3B8' } } },
      border: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // SHEET 1: Resumen Ejecutivo
    const ws1 = workbook.addWorksheet('Resumen Ejecutivo', { pageSetup: { orientation: 'portrait', paperSize: 9, fitToPage: true } });

    ws1.mergeCells('A1:D1');
    ws1.getCell('A1').value = 'SIVACAD - Reporte Estrategico de Riesgo de Desercion';
    ws1.getCell('A1').font = STYLES.title.font;
    ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.addRow([]);

    ws1.mergeCells('A2:D2');
    ws1.getCell('A2').value = 'Periodo: ' + periodo + ' | Generado: ' + generatedAt.toLocaleDateString('es-MX') + ' por ' + generatedBy;
    ws1.getCell('A2').font = STYLES.meta.font;
    ws1.getCell('A2').alignment = { horizontal: 'center' };
    ws1.addRow([]);

    this._addSheetRow(ws1, ['RESUMEN EJECUTIVO'], 1, ['A', 'B', 'C', 'D']);
    ws1.getCell('A' + ws1.lastRow.number).font = STYLES.subtitle.font;

    this._writeSummaryTable(ws1, r, STYLES);
    ws1.addRow([]);

    // Insights
    this._addSheetRow(ws1, ['INSIGHTS ESTRATEGICOS'], 1, ['A', 'B', 'C', 'D']);
    ws1.getCell('A' + ws1.lastRow.number).font = STYLES.subtitle.font;

    (data.insights || []).forEach(function(ins) {
      ws1.addRow(['']);
      var row = ws1.lastRow;
      ws1.mergeCells('A' + row.number + ':D' + row.number);
      ws1.getCell('A' + row.number).value = ins;
      ws1.getCell('A' + row.number).font = STYLES.cell.font;
      ws1.getCell('A' + row.number).alignment = { wrapText: true, vertical: 'top' };
    });

    ['A', 'B', 'C', 'D'].forEach(function(col) { ws1.getColumn(col).width = 28; });

    // SHEET 2: Datos Tabulados
    var ws2 = workbook.addWorksheet('Datos por Parciales y Ciclos', {
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true }
    });

    ws2.mergeCells('A1:H1');
    ws2.getCell('A1').value = 'SIVACAD - Datos Tabulados de Desercion';
    ws2.getCell('A1').font = STYLES.title.font;
    ws2.getCell('A1').alignment = { horizontal: 'center' };
    ws2.getRow(1).height = 25;
    ws2.addRow([]);

    // Parciales table
    this._addSheetRow(ws2, ['ANALISIS POR PARCIALES ACADEMICOS'], 1, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
    ws2.getCell('A' + ws2.lastRow.number).font = STYLES.subtitle.font;

    this._writeParcialesTable(ws2, data.parciales || [], STYLES);
    ws2.addRow([]);

    // Ciclos table
    this._addSheetRow(ws2, ['COMPARATIVA POR CICLOS ESCOLARES'], 1, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    ws2.getCell('A' + ws2.lastRow.number).font = STYLES.subtitle.font;

    this._writeCiclosTable(ws2, data.ciclos || [], STYLES);
    ws2.addRow([]);

    // Materias criticas
    this._addSheetRow(ws2, ['MATERIAS CRITICAS'], 1, ['A', 'B', 'C', 'D', 'E', 'F']);
    ws2.getCell('A' + ws2.lastRow.number).font = STYLES.subtitle.font;

    this._writeMateriasTable(ws2, data.por_materia || [], STYLES);
    ws2.addRow([]);

    // Progresion temporal
    this._addSheetRow(ws2, ['PROGRESION TEMPORAL DEL RIESGO'], 1, ['A', 'B', 'C', 'D', 'E', 'F']);
    ws2.getCell('A' + ws2.lastRow.number).font = STYLES.subtitle.font;

    this._writeProgresionTable(ws2, data.progresion || [], STYLES);

    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(function(col) {
      ws2.getColumn(col).width = 18;
    });

    // SHEET 3: Alertas Recientes
    var ws3 = workbook.addWorksheet('Alertas Recientes', {
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true }
    });

    ws3.mergeCells('A1:G1');
    ws3.getCell('A1').value = 'SIVACAD - Alertas Recientes de Desercion';
    ws3.getCell('A1').font = STYLES.title.font;
    ws3.getCell('A1').alignment = { horizontal: 'center' };
    ws3.addRow([]);

    this._writeAlertasTable(ws3, data.alertas_recientes || [], STYLES);
    ws3.addRow([]);

    var porCarreraData = data.por_carrera || [];
    if (porCarreraData.length > 0) {
      this._addSheetRow(ws3, ['ANALISIS POR CARRERA'], 1, ['A', 'B', 'C', 'D', 'E']);
      ws3.getCell('A' + ws3.lastRow.number).font = STYLES.subtitle.font;

      var hRow = ws3.addRow(['Carrera', 'Alertas Totales', 'Alto/Critico', 'Pendientes']);
      hRow.eachCell(function(cell) {
        cell.font = STYLES.header.font;
        cell.fill = STYLES.header.fill;
        cell.border = { top: STYLES.border, left: STYLES.border, bottom: STYLES.border, right: STYLES.border };
      });

      porCarreraData.forEach(function(c) {
        var r = ws3.addRow([c.carrera, toNum(c.total_alertas), toNum(c.alto_riesgo), toNum(c.pendientes)]);
        r.eachCell(function(cell, col) {
          cell.font = col === 1 ? STYLES.cell.font : STYLES.number.font;
          cell.border = { top: STYLES.border, left: STYLES.border, bottom: STYLES.border, right: STYLES.border };
        });
      });
    }

    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(function(col) {
      ws3.getColumn(col).width = 22;
    });

    // Auto-fit columns for all sheets
    [ws1, ws2, ws3].forEach(function(ws) {
      ws.columns.forEach(function(col, i) {
        var letter = col.letter;
        try { ws.getColumn(letter).setAutoSize(true); } catch(e) {}
      });
    });

    var buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  _writeSummaryTable(ws, r, S) {
    var headers = ['Indicador', 'Valor'];
    var hRow = ws.addRow(headers);
    hRow.eachCell(function(cell) {
      cell.font = S.header.font;
      cell.fill = S.header.fill;
      cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
    });

    var data = [
      ['Alumnos Registrados', toNum(r.alumnos)],
      ['Docentes', toNum(r.docentes)],
      ['Grupos Academicos', toNum(r.grupos)],
      ['Evaluaciones Activas', toNum(r.evaluaciones)],
      ['Alertas Totales', toNum(r.alertas_total)],
      ['Alertas Pendientes', toNum(r.alertas_pendientes)],
      ['Alertas Atendidas', toNum(r.alertas_atendidas)],
      ['Tasa de Atencion', toNum(r.tasa_atencion) + '%'],
      ['Periodo Activo', r.periodo_activo || 'N/D']
    ];

    data.forEach(function(row) {
      var r2 = ws.addRow(row);
      r2.getCell(1).font = S.cell.font;
      r2.getCell(2).font = S.number.font;
      r2.getCell(1).border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
      r2.getCell(2).border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
      r2.getCell(2).alignment = { horizontal: 'center' };
    });
  }

  _writeParcialesTable(ws, parciales, S) {
    var headers = ['Parcial', 'Promedio', 'Riesgos', 'Reprob.', 'Afectados', 'Activos', 'Desertores', 'Tasa Deser.', 'Nivel'];
    var hRow = ws.addRow(headers);
    hRow.eachCell(function(cell) {
      cell.font = S.header.font;
      cell.fill = S.header.fill;
      cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    parciales.forEach(function(p) {
      var nivel = p.nivel_riesgo || 'N/D';
      var r = ws.addRow([
        'Parcial ' + p.numero_parcial, toNum(p.promedio_general),
        toNum(p.total_riesgos), toNum(p.total_reprobadas),
        toNum(p.alumnos_afectados), toNum(p.total_activos),
        toNum(p.total_desertores), toNum(p.tasa_desercion) + '%', nivel
      ]);
      r.eachCell(function(cell, col) {
        cell.font = col === 1 || col === 9 ? S.cell.font : S.number.font;
        cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      if (nivel === 'Critico' || nivel === 'Alto') {
        r.getCell(9).font = { name: 'Arial', size: 9, bold: true, color: { argb: riskColor(nivel) } };
      }
    });
  }

  _writeCiclosTable(ws, ciclos, S) {
    var headers = ['Ciclo', 'Alertas', 'Alto/Critico', 'Riesgo Prom.', 'Total Alumnos', 'Tasa Deser.', 'Nivel'];
    var hRow = ws.addRow(headers);
    hRow.eachCell(function(cell) {
      cell.font = S.header.font;
      cell.fill = S.header.fill;
      cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    ciclos.forEach(function(c) {
      var nivel = toNum(c.tasa_desercion) >= 75 ? 'Critico' : toNum(c.tasa_desercion) >= 50 ? 'Alto' : toNum(c.tasa_desercion) >= 25 ? 'Medio' : 'Bajo';
      var r = ws.addRow([
        c.ciclo, toNum(c.alertas), toNum(c.alto_riesgo),
        toNum(c.riesgo_promedio), toNum(c.total_alumnos),
        toNum(c.tasa_desercion) + '%', nivel
      ]);
      r.eachCell(function(cell, col) {
        cell.font = col === 1 || col === 7 ? S.cell.font : S.number.font;
        cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    });
  }

  _writeMateriasTable(ws, materias, S) {
    var headers = ['Materia', 'Alumnos Eval.', 'Promedio', 'Reprobados', 'Nivel'];
    var hRow = ws.addRow(headers);
    hRow.eachCell(function(cell) {
      cell.font = S.header.font;
      cell.fill = S.header.fill;
      cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    materias.forEach(function(m) {
      var r = ws.addRow([
        m.materia, toNum(m.alumnos_evaluados),
        toNum(m.promedio), toNum(m.reprobados), m.nivel
      ]);
      r.eachCell(function(cell, col) {
        cell.font = col === 1 || col === 5 ? S.cell.font : S.number.font;
        cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    });
  }

  _writeProgresionTable(ws, progresion, S) {
    var headers = ['Mes', 'Bajo', 'Medio', 'Alto', 'Critico', 'Total'];
    var hRow = ws.addRow(headers);
    hRow.eachCell(function(cell) {
      cell.font = S.header.font;
      cell.fill = S.header.fill;
      cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    progresion.forEach(function(p) {
      var r = ws.addRow([
        p.mes, toNum(p.bajo), toNum(p.medio),
        toNum(p.alto), toNum(p.critico), toNum(p.total)
      ]);
      r.eachCell(function(cell) {
        cell.font = S.number.font;
        cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    });
  }

  _writeAlertasTable(ws, alertas, S) {
    var headers = ['#', 'Matricula', 'Alumno', 'Riesgo', 'Puntaje', 'Estado', 'Periodo'];
    var hRow = ws.addRow(headers);
    hRow.eachCell(function(cell) {
      cell.font = S.header.font;
      cell.fill = S.header.fill;
      cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    alertas.forEach(function(a, i) {
      var r = ws.addRow([
        i + 1, a.matricula || '',
        (a.nombres || '') + ' ' + (a.apellido_paterno || '') + ' ' + (a.apellido_materno || ''),
        a.nivel_riesgo || '', toNum(a.puntaje_riesgo),
        a.atendida ? 'Atendida' : 'Pendiente', a.nombre_periodo || ''
      ]);
      r.eachCell(function(cell, col) {
        cell.font = col === 1 || col === 4 || col === 6 ? S.cell.font : S.number.font;
        cell.border = { top: S.border, left: S.border, bottom: S.border, right: S.border };
        cell.alignment = { horizontal: col === 2 ? 'left' : 'center', vertical: 'middle' };
      });
    });
  }

  _addSheetRow(ws, values, startCol, letters) {
    var row = ws.addRow(values);
    return row;
  }
}

module.exports = new DesercionExcel();
