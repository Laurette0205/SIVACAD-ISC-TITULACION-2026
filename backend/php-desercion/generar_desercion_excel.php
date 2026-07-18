<?php
/**
 * generar_desercion_excel.php
 *
 * Generador oficial del Excel del Reporte Estratégico de Riesgo de Deserción.
 * Usa PhpSpreadsheet + desercion_service.php (sin consultas SQL directas).
 *
 * Uso HTTP:
 *   .../generar_desercion_excel.php
 *   .../generar_desercion_excel.php?id_alumno=42
 *
 * Uso CLI:
 *   php generar_desercion_excel.php > reporte.xlsx
 *   php generar_desercion_excel.php id_alumno=42 > reporte.xlsx
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE);
ini_set('display_errors', '0');
ob_start();

require_once __DIR__ . '/desercion_service.php';
require_once __DIR__ . '/../php-kardex/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

// ──────────────────────────────────────────────
// PARÁMETROS
// ──────────────────────────────────────────────

function getParam(string $key, $default = null): mixed
{
    if (PHP_SAPI === 'cli') {
        global $argv;
        foreach ($argv as $arg) {
            if (str_starts_with($arg, $key . '=')) {
                $val = substr($arg, strlen($key) + 1);
                if ($val === '1' || $val === 'true') return true;
                if ($val === '0' || $val === 'false') return false;
                return $val;
            }
        }
        return $default;
    }
    $val = $_GET[$key] ?? $_POST[$key] ?? $default;
    if ($val === '1' || $val === 'true') return true;
    if ($val === '0' || $val === 'false') return false;
    return $val;
}

function getIntParam(string $key, ?int $default = null): ?int
{
    $val = getParam($key);
    if ($val === null || $val === '' || $val === false) return $default;
    $n = (int)$val;
    return $n > 0 ? $n : $default;
}

function sendError(int $code, string $message): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// ──────────────────────────────────────────────
// ESTILOS COMPARTIDOS
// ──────────────────────────────────────────────

function colL(int $c): string { return chr(64 + $c); }

function applySectionTitle($ws, int $row, string $text): void
{
    $ws->setCellValue('A' . $row, $text);
    $ws->getStyle('A' . $row)->applyFromArray([
        'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF1E293B'], 'name' => 'Arial'],
    ]);
}

function applyHeader($ws, int $row, array $cols, string $bgColor = 'FF4F46E5'): void
{
    $i = 1;
    foreach ($cols as $label) {
        $cell = colL($i) . $row;
        $ws->setCellValue($cell, $label);
        $ws->getStyle($cell)->applyFromArray([
            'font'      => ['bold' => true, 'size' => 9, 'color' => ['argb' => 'FFFFFFFF'], 'name' => 'Arial'],
            'fill'      => ['type' => Fill::FILL_SOLID, 'color' => ['argb' => $bgColor]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders'   => ['allBorders' => ['style' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
        ]);
        $i++;
    }
}

function applyCellStyle($ws, int $row, int $cols, ?string $bgColor = null): void
{
    for ($i = 1; $i <= $cols; $i++) {
        $cell = colL($i) . $row;
        $style = [
            'font'     => ['size' => 9, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial'],
            'borders'  => ['bottom' => ['style' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
        ];
        if ($bgColor) {
            $style['fill'] = ['type' => Fill::FILL_SOLID, 'color' => ['argb' => $bgColor]];
        }
        $ws->getStyle($cell)->applyFromArray($style);
    }
}

// ──────────────────────────────────────────────
// GENERACIÓN EXCEL
// ──────────────────────────────────────────────

try {
    $idAlumno = getIntParam('id_alumno');

    $service = new DesercionService();

    if ($idAlumno !== null) {
        $data = $service->compilarReporteAlumno($idAlumno);
    } else {
        $data = $service->compilarReporteInstitucional();
    }

    $inst       = $data['datos_institucion'] ?? [];
    $periodo    = $data['datos_periodo'] ?? [];
    $alumno     = $data['datos_alumno'];
    $carrera    = $data['datos_carrera'];
    $grupo      = $data['datos_grupo'];
    $estadoAc   = $data['estado_academico'];
    $indic      = $data['indicadores_desercion'] ?? [];
    $dist       = $data['distribucion_riesgo'] ?? [];
    $parciales  = $data['parciales'] ?? [];
    $ciclos     = $data['ciclos'] ?? [];
    $progresion = $data['progresion_temporal'] ?? [];
    $porCarrera = $data['analisis_carrera'] ?? [];
    $porMateria = $data['materias_criticas'] ?? [];
    $alertas    = $data['alertas_recientes'] ?? [];
    $insights   = $data['resumen_ia'] ?? [];
    $observ     = $data['observaciones'] ?? [];
    $recom      = $data['recomendaciones'] ?? [];
    $folio      = $data['folio'] ?? '—';
    $fecha      = $data['fecha_emision'] ?? date('d/m/Y H:i:s');
    $zona       = $data['zona_horaria'] ?? 'America/Mexico_City';
    $hayAlumno  = $alumno !== null && is_array($alumno);

    $periodoNombre = $periodo['nombre_periodo'] ?? 'N/D';
    $totalDist = 0;
    foreach ($dist as $d) $totalDist += (int)($d['total'] ?? 0);

    $spreadsheet = new Spreadsheet();
    $spreadsheet->getProperties()
        ->setCreator('SIVACAD')
        ->setTitle('Reporte de Desercion')
        ->setSubject('Reporte Estrategico de Riesgo de Desercion')
        ->setDescription('Reporte generado por SIVACAD')
        ->setCreated(time());

    $titleFont = ['bold' => true, 'size' => 14, 'color' => ['argb' => 'FF0F172A'], 'name' => 'Arial'];
    $metaFont  = ['size' => 8, 'italic' => true, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial'];

    // ══════════════════════════════════════════════
    // HOJA 1: PORTADA
    // ══════════════════════════════════════════════
    $ws1 = $spreadsheet->getActiveSheet();
    $ws1->setTitle('Portada');
    $ws1->setShowGridlines(false);
    foreach (['A' => 40, 'B' => 40] as $c => $w) $ws1->getColumnDimension($c)->setWidth($w);

    $ws1->mergeCells('A1:B1');
    $ws1->setCellValue('A1', 'SIVACAD');
    $ws1->getStyle('A1')->applyFromArray(['font' => ['bold' => true, 'size' => 24, 'color' => ['argb' => 'FF4F46E5'], 'name' => 'Arial']]);
    $ws1->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $ws1->getRowDimension(1)->setRowHeight(40);

    $ws1->mergeCells('A2:B2');
    $ws1->setCellValue('A2', $inst['sistema_completo'] ?? 'Sistema Integral para la Valoracion del Conocimiento y Aprovechamiento Academico');
    $ws1->getStyle('A2')->applyFromArray(['font' => ['size' => 10, 'color' => ['argb' => 'FF64748B'], 'name' => 'Arial']]);
    $ws1->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    $row = 4;
    $ws1->mergeCells('A' . $row . ':B' . $row);
    $ws1->setCellValue('A' . $row, 'REPORTE ESTRATEGICO DE RIESGO DE DESERCION');
    $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => 'FF0F172A'], 'name' => 'Arial']]);
    $ws1->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $ws1->getRowDimension($row)->setRowHeight(30);

    $row += 2;
    $ws1->setCellValue('A' . $row, 'Periodo:');
    $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
    $ws1->setCellValue('B' . $row, $periodoNombre);
    $row++;
    $ws1->setCellValue('A' . $row, 'Folio:');
    $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
    $ws1->setCellValue('B' . $row, $folio);
    $row++;
    $ws1->setCellValue('A' . $row, 'Fecha de Emision:');
    $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
    $ws1->setCellValue('B' . $row, $fecha);
    $row++;
    $ws1->setCellValue('A' . $row, 'Zona Horaria:');
    $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
    $ws1->setCellValue('B' . $row, $zona);
    $row++;
    $ws1->setCellValue('A' . $row, 'Institucion:');
    $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
    $ws1->setCellValue('B' . $row, ($inst['nombre_institucion'] ?? '') . ' - ' . ($inst['nombre_campus'] ?? ''));
    $row++;
    $ws1->setCellValue('A' . $row, 'Sistema:');
    $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
    $ws1->setCellValue('B' . $row, $inst['sistema'] ?? 'SIVACAD');

    $row += 2;
    $ws1->mergeCells('A' . $row . ':B' . $row);
    $ws1->setCellValue('A' . $row, 'Documento generado por SIVACAD - IA de Desercion');
    $ws1->getStyle('A' . $row)->applyFromArray($metaFont);
    $ws1->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    $row++;
    $ws1->mergeCells('A' . $row . ':B' . $row);
    $ws1->setCellValue('A' . $row, 'CONFIDENCIAL - Uso Academico Exclusivo');
    $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 9, 'color' => ['argb' => 'FFDC2626'], 'name' => 'Arial']]);
    $ws1->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    if ($hayAlumno) {
        $row += 2;
        $ws1->mergeCells('A' . $row . ':B' . $row);
        $ws1->setCellValue('A' . $row, 'DATOS DEL ALUMNO');
        $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => 'FF1E40AF'], 'name' => 'Arial']]);
        $row++;
        $ws1->setCellValue('A' . $row, 'Nombre:');
        $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
        $ws1->setCellValue('B' . $row, $alumno['nombre_completo'] ?? '—');
        $row++;
        $ws1->setCellValue('A' . $row, 'Matricula:');
        $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
        $ws1->setCellValue('B' . $row, $alumno['matricula'] ?? '—');
        $row++;
        $ws1->setCellValue('A' . $row, 'Carrera:');
        $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
        $ws1->setCellValue('B' . $row, $alumno['nombre_carrera'] ?? ($carrera['nombre_carrera'] ?? '—'));
        $row++;
        $ws1->setCellValue('A' . $row, 'Semestre:');
        $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
        $ws1->setCellValue('B' . $row, (string)($alumno['semestre_actual'] ?? '—'));
        $row++;
        $ws1->setCellValue('A' . $row, 'Estatus:');
        $ws1->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']]);
        $ws1->setCellValue('B' . $row, $alumno['estatus_academico'] ?? '—');
    }

    // ══════════════════════════════════════════════
    // HOJA 2: RESUMEN EJECUTIVO
    // ══════════════════════════════════════════════
    $ws2 = $spreadsheet->createSheet();
    $ws2->setTitle('Resumen Ejecutivo');
    foreach (['A' => 35, 'B' => 35, 'C' => 35, 'D' => 35, 'E' => 35, 'F' => 35] as $c => $w) {
        $ws2->getColumnDimension($c)->setWidth($w);
    }
    $ws2->setShowGridlines(false);

    $ws2->mergeCells('A1:F1');
    $ws2->setCellValue('A1', 'SIVACAD - Resumen Ejecutivo de Riesgo de Desercion');
    $ws2->getStyle('A1')->applyFromArray(['font' => $titleFont]);
    $ws2->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $ws2->getRowDimension(1)->setRowHeight(28);

    $ws2->mergeCells('A2:F2');
    $ws2->setCellValue('A2', 'Periodo: ' . $periodoNombre . ' | Generado: ' . $fecha);
    $ws2->getStyle('A2')->applyFromArray(['font' => $metaFont]);
    $ws2->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    $row = 4;
    applySectionTitle($ws2, $row, 'INDICADORES GENERALES');
    $row++;

    $alertTot  = (int)($indic['alertas_totales'] ?? 0);
    $alertPend = (int)($indic['alertas_pendientes'] ?? 0);
    $alertAte  = (int)($indic['alertas_atendidas'] ?? 0);
    $tasaAt    = (int)($indic['tasa_atencion'] ?? 0);
    $totalAl   = (int)($indic['total_alumnos'] ?? 0);
    $totalGr   = (int)($indic['total_grupos'] ?? 0);

    $cards = [
        ['Alertas Totales', $alertTot, 'FF4F46E5'],
        ['Pendientes', $alertPend, 'FFF97316'],
        ['Atendidas', $alertAte, 'FF16A34A'],
        ['Tasa Atencion', $tasaAt . '%', $tasaAt >= 50 ? 'FF16A34A' : 'FFDC2626'],
        ['Alumnos', $totalAl, 'FF3B82F6'],
        ['Grupos', $totalGr, 'FF8B5CF6'],
    ];
    $r = 0;
    foreach ($cards as $c) {
        $col = colL($r + 1);
        $ws2->setCellValue($col . $row, $c[0]);
        $ws2->getStyle($col . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 8, 'color' => ['argb' => 'FF64748B'], 'name' => 'Arial'], 'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]]);
        $ws2->setCellValue($col . ($row + 1), $c[1]);
        $ws2->getStyle($col . ($row + 1))->applyFromArray(['font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => $c[2]], 'name' => 'Arial'], 'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]]);
        $r++;
    }
    $ws2->getRowDimension($row + 1)->setRowHeight(32);
    $row += 3;

    applySectionTitle($ws2, $row, 'DISTRIBUCION DE RIESGO');
    $row++;
    applyHeader($ws2, $row, ['Nivel', 'Total', 'Porcentaje', 'Descripcion']);
    $row++;
    foreach ($dist as $d) {
        $nivel = $d['nivel'] ?? '';
        $tot   = (int)($d['total'] ?? 0);
        $pct   = $totalDist > 0 ? round(($tot / $totalDist) * 100, 1) : 0;
        $desc  = match ($nivel) { 'Critico' => 'Accion inmediata', 'Alto' => 'Intervencion prioritaria', 'Medio' => 'Seguimiento preventivo', 'Bajo' => 'Riesgo controlado', default => '' };
        $ws2->setCellValue('A' . $row, $nivel);
        $ws2->setCellValue('B' . $row, $tot);
        $ws2->setCellValue('C' . $row, $pct . '%');
        $ws2->setCellValue('D' . $row, $desc);
        applyCellStyle($ws2, $row, 4);
        $row++;
    }

    $row++;
    applySectionTitle($ws2, $row, 'INSIGHTS ESTRATEGICOS');
    $row++;
    foreach ($insights as $ins) {
        $ws2->mergeCells('A' . $row . ':F' . $row);
        $ws2->setCellValue('A' . $row, (string)$ins);
        $ws2->getStyle('A' . $row)->applyFromArray(['font' => ['size' => 9, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial'], 'alignment' => ['wrapText' => true]]);
        $ws2->getRowDimension($row)->setRowHeight(30);
        $row++;
    }

    // ══════════════════════════════════════════════
    // HOJA 3: INDICADORES
    // ══════════════════════════════════════════════
    $ws3 = $spreadsheet->createSheet();
    $ws3->setTitle('Indicadores');
    foreach (['A' => 22, 'B' => 16, 'C' => 16, 'D' => 16, 'E' => 16, 'F' => 16, 'G' => 16, 'H' => 16] as $c => $w) {
        $ws3->getColumnDimension($c)->setWidth($w);
    }

    $ws3->mergeCells('A1:H1');
    $ws3->setCellValue('A1', 'SIVACAD - Indicadores de Desercion');
    $ws3->getStyle('A1')->applyFromArray(['font' => $titleFont]);
    $ws3->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    $row = 3;

    if (count($parciales) > 0) {
        applySectionTitle($ws3, $row, 'ANALISIS POR PARCIALES');
        $row++;
        applyHeader($ws3, $row, ['Parcial', 'Promedio', 'Riesgos', 'Reprob.', 'Afect.', 'Activos', 'Desert.', 'Tasa Desercion'], 'FF3B82F6');
        $row++;
        foreach ($parciales as $p) {
            $ws3->setCellValue('A' . $row, 'Parcial ' . ($p['numero_parcial'] ?? ''));
            $ws3->setCellValue('B' . $row, $p['promedio_general'] ?? 0);
            $ws3->setCellValue('C' . $row, $p['total_riesgos'] ?? 0);
            $ws3->setCellValue('D' . $row, $p['total_reprobadas'] ?? 0);
            $ws3->setCellValue('E' . $row, $p['alumnos_afectados'] ?? 0);
            $ws3->setCellValue('F' . $row, $p['total_activos'] ?? 0);
            $ws3->setCellValue('G' . $row, $p['total_desertores'] ?? 0);
            $ws3->setCellValue('H' . $row, ($p['tasa_desercion'] ?? 0) . '%');
            applyCellStyle($ws3, $row, 8, ($row % 2 === 0) ? 'FFF8FAFC' : null);
            $row++;
        }
        $row++;
    }

    if (count($ciclos) > 0) {
        applySectionTitle($ws3, $row, 'COMPARATIVA POR CICLOS');
        $row++;
        applyHeader($ws3, $row, ['Ciclo', 'Alertas', 'Alto/Critico', 'Riesgo Prom.', 'Total Alumnos', 'Tasa Desercion'], 'FF8B5CF6');
        $row++;
        foreach ($ciclos as $c) {
            $ws3->setCellValue('A' . $row, $c['ciclo'] ?? '');
            $ws3->setCellValue('B' . $row, $c['alertas'] ?? 0);
            $ws3->setCellValue('C' . $row, $c['alto_riesgo'] ?? 0);
            $ws3->setCellValue('D' . $row, $c['riesgo_promedio'] ?? 0);
            $ws3->setCellValue('E' . $row, $c['total_alumnos'] ?? 0);
            $ws3->setCellValue('F' . $row, ($c['tasa_desercion'] ?? 0) . '%');
            applyCellStyle($ws3, $row, 6, ($row % 2 === 0) ? 'FFF8FAFC' : null);
            $row++;
        }
        $row++;
    }

    if (count($progresion) > 0) {
        applySectionTitle($ws3, $row, 'PROGRESION TEMPORAL');
        $row++;
        applyHeader($ws3, $row, ['Mes', 'Bajo', 'Medio', 'Alto', 'Critico', 'Total'], 'FF8B5CF6');
        $row++;
        foreach ($progresion as $p) {
            $ws3->setCellValue('A' . $row, $p['mes'] ?? '');
            $ws3->setCellValue('B' . $row, $p['bajo'] ?? 0);
            $ws3->setCellValue('C' . $row, $p['medio'] ?? 0);
            $ws3->setCellValue('D' . $row, $p['alto'] ?? 0);
            $ws3->setCellValue('E' . $row, $p['critico'] ?? 0);
            $ws3->setCellValue('F' . $row, $p['total'] ?? 0);
            applyCellStyle($ws3, $row, 6, ($row % 2 === 0) ? 'FFF8FAFC' : null);
            $row++;
        }
        $row++;
    }

    if (count($porMateria) > 0) {
        applySectionTitle($ws3, $row, 'MATERIAS CRITICAS');
        $row++;
        applyHeader($ws3, $row, ['Materia', 'Alumnos Eval.', 'Promedio', 'Reprobados', 'Nivel'], 'FFDC2626');
        $row++;
        foreach ($porMateria as $m) {
            $ws3->setCellValue('A' . $row, $m['materia'] ?? '');
            $ws3->setCellValue('B' . $row, $m['alumnos_evaluados'] ?? 0);
            $ws3->setCellValue('C' . $row, $m['promedio'] ?? 0);
            $ws3->setCellValue('D' . $row, $m['reprobados'] ?? 0);
            $ws3->setCellValue('E' . $row, $m['nivel'] ?? '');
            applyCellStyle($ws3, $row, 5, ($row % 2 === 0) ? 'FFF8FAFC' : null);
            $row++;
        }
        $row++;
    }

    if ($hayAlumno && $estadoAc) {
        applySectionTitle($ws3, $row, 'ESTADO ACADEMICO DEL ALUMNO');
        $row++;
        applyHeader($ws3, $row, ['Promedio General', 'Materias Cursadas', 'Acreditadas', 'Reprobadas', 'Creditos Acum.', '% Aprobacion'], 'FF1E40AF');
        $row++;
        $ws3->setCellValue('A' . $row, number_format((float)($estadoAc['promedio_general'] ?? 0), 2));
        $ws3->setCellValue('B' . $row, $estadoAc['materias_cursadas'] ?? 0);
        $ws3->setCellValue('C' . $row, $estadoAc['materias_acreditadas'] ?? 0);
        $ws3->setCellValue('D' . $row, $estadoAc['materias_reprobadas'] ?? 0);
        $ws3->setCellValue('E' . $row, $estadoAc['creditos_acumulados'] ?? 0);
        $ws3->setCellValue('F' . $row, ($estadoAc['porcentaje_aprobacion'] ?? 0) . '%');
        applyCellStyle($ws3, $row, 6);
        $row++;
    }

    // ══════════════════════════════════════════════
    // HOJA 4: ALERTAS Y DETALLE
    // ══════════════════════════════════════════════
    $ws4 = $spreadsheet->createSheet();
    $ws4->setTitle('Alertas y Detalle');
    foreach (['A' => 8, 'B' => 16, 'C' => 35, 'D' => 14, 'E' => 10, 'F' => 14, 'G' => 14] as $c => $w) {
        $ws4->getColumnDimension($c)->setWidth($w);
    }

    $ws4->mergeCells('A1:G1');
    $ws4->setCellValue('A1', 'SIVACAD - Alertas Recientes y Detalle de Desercion');
    $ws4->getStyle('A1')->applyFromArray(['font' => $titleFont]);
    $ws4->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    $row = 3;

    if (count($alertas) > 0) {
        applySectionTitle($ws4, $row, 'ALERTAS RECIENTES');
        $row++;
        applyHeader($ws4, $row, ['#', 'Matricula', 'Alumno', 'Riesgo', 'Puntaje', 'Estado', 'Periodo'], 'FF4F46E5');
        $row++;
        $idx = 1;
        foreach ($alertas as $a) {
            $nom    = $a['nombre_completo'] ?? trim(($a['nombres'] ?? '') . ' ' . ($a['apellido_paterno'] ?? '') . ' ' . ($a['apellido_materno'] ?? ''));
            $estado = !empty($a['atendida']) ? 'Atendida' : 'Pendiente';
            $ws4->setCellValue('A' . $row, $idx);
            $ws4->setCellValue('B' . $row, $a['matricula'] ?? '');
            $ws4->setCellValue('C' . $row, $nom);
            $ws4->setCellValue('D' . $row, $a['nivel_riesgo'] ?? '');
            $ws4->setCellValue('E' . $row, (int)($a['puntaje_riesgo'] ?? 0));
            $ws4->setCellValue('F' . $row, $estado);
            $ws4->setCellValue('G' . $row, $a['nombre_periodo'] ?? '');
            applyCellStyle($ws4, $row, 7, ($row % 2 === 0) ? 'FFF8FAFC' : null);
            $idx++;
            $row++;
        }
        $row++;
    }

    if (count($porCarrera) > 0) {
        applySectionTitle($ws4, $row, 'ANALISIS POR CARRERA');
        $row++;
        applyHeader($ws4, $row, ['Carrera', 'Alertas Totales', 'Alto/Critico', 'Pendientes'], 'FF0EA5E9');
        $row++;
        foreach ($porCarrera as $c) {
            $ws4->setCellValue('A' . $row, $c['carrera'] ?? '');
            $ws4->setCellValue('B' . $row, $c['total_alertas'] ?? 0);
            $ws4->setCellValue('C' . $row, $c['alto_riesgo'] ?? 0);
            $ws4->setCellValue('D' . $row, $c['pendientes'] ?? 0);
            applyCellStyle($ws4, $row, 4, ($row % 2 === 0) ? 'FFF8FAFC' : null);
            $row++;
        }
        $row++;
    }

    if (count($observ) > 0) {
        applySectionTitle($ws4, $row, 'OBSERVACIONES Y SEGUIMIENTO');
        $row++;
        applyHeader($ws4, $row, ['Accion', 'Observaciones', 'Estado', 'Responsable'], 'FF059669');
        $row++;
        foreach ($observ as $o) {
            $ws4->setCellValue('A' . $row, $o['accion'] ?? '');
            $ws4->setCellValue('B' . $row, $o['observaciones'] ?? '');
            $ws4->setCellValue('C' . $row, $o['estado'] ?? '');
            $ws4->setCellValue('D' . $row, $o['usuario_nombre'] ?? '');
            applyCellStyle($ws4, $row, 4, ($row % 2 === 0) ? 'FFF8FAFC' : null);
            $row++;
        }
        $row++;
    }

    if (count($recom) > 0) {
        applySectionTitle($ws4, $row, 'RECOMENDACIONES');
        $row++;
        foreach ($recom as $r) {
            if (!is_string($r) || trim($r) === '') continue;
            $ws4->mergeCells('A' . $row . ':G' . $row);
            $ws4->setCellValue('A' . $row, $r);
            $ws4->getStyle('A' . $row)->applyFromArray(['font' => ['size' => 9, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial'], 'alignment' => ['wrapText' => true]]);
            $ws4->getRowDimension($row)->setRowHeight(24);
            $row++;
        }
        $row++;
    }

    // Cierre institucional
    $row++;
    $ws4->mergeCells('A' . $row . ':G' . $row);
    $ws4->setCellValue('A' . $row, '--- FIN DEL REPORTE ---');
    $ws4->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial']]);
    $ws4->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $row++;
    $ws4->mergeCells('A' . $row . ':G' . $row);
    $ws4->setCellValue('A' . $row, 'SIVACAD - Sistema Integral para la Valoracion del Conocimiento y Aprovechamiento Academico');
    $ws4->getStyle('A' . $row)->applyFromArray(['font' => ['italic' => true, 'size' => 8, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial']]);
    $ws4->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $row++;
    $ws4->mergeCells('A' . $row . ':G' . $row);
    $ws4->setCellValue('A' . $row, 'CONFIDENCIAL - Uso Academico Exclusivo');
    $ws4->getStyle('A' . $row)->applyFromArray(['font' => ['bold' => true, 'size' => 9, 'color' => ['argb' => 'FFDC2626'], 'name' => 'Arial']]);
    $ws4->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    // Autoajuste de columnas
    foreach ([$ws2, $ws3, $ws4] as $ws) {
        foreach (range('A', 'H') as $col) {
            try { $ws->getColumnDimension($col)->setAutoSize(true); } catch (Exception $e) { break; }
        }
    }

    $writer = new Xlsx($spreadsheet);
    @ob_end_clean();

    if (PHP_SAPI === 'cli') {
        $writer->save('php://stdout');
    } else {
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="reporte_desercion_sivacad.xlsx"');
        header('Cache-Control: max-age=0');
        $writer->save('php://output');
    }
    exit;

} catch (InvalidArgumentException $e) {
    @ob_end_clean();
    sendError(404, $e->getMessage());
} catch (Exception $e) {
    @ob_end_clean();
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
        exit(1);
    }
    sendError(500, 'Error al generar Excel: ' . $e->getMessage());
}
