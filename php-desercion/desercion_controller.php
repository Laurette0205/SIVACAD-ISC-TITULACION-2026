<?php
/**
 * desercion_controller.php
 *
 * Controlador principal del módulo de IA de Deserción.
 * Recibe la solicitud, valida parámetros, invoca el servicio
 * y devuelve la salida correcta según la acción solicitada.
 *
 * Acciones:
 *   action=preview  → JSON con datos del reporte
 *   action=pdf      → PDF generado con Dompdf + template
 *   action=excel    → XLSX generado con PhpSpreadsheet
 *
 * Uso HTTP:
 *   .../desercion_controller.php?action=preview
 *   .../desercion_controller.php?action=pdf&download=1
 *   .../desercion_controller.php?action=excel
 *   .../desercion_controller.php?action=preview&id_alumno=42
 *
 * Uso CLI:
 *   php desercion_controller.php action=preview
 *   php desercion_controller.php action=pdf > reporte.pdf
 *   php desercion_controller.php action=excel download=1 > reporte.xlsx
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE);
ini_set('display_errors', '0');
ob_start();

require_once __DIR__ . '/desercion_service.php';
require_once __DIR__ . '/../php-kardex/vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

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

function sendJson(int $code, array $data): never
{
    @ob_end_clean();
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function sendError(int $code, string $message): never
{
    sendJson($code, ['ok' => false, 'message' => $message]);
}

// ──────────────────────────────────────────────
// VALIDACIÓN
// ──────────────────────────────────────────────

function validarAccion(string $accion): string
{
    $acciones = ['preview', 'pdf', 'excel'];
    if (!in_array($accion, $acciones, true)) {
        sendError(400, 'Acción no válida. Use: ' . implode(', ', $acciones));
    }
    return $accion;
}

// ──────────────────────────────────────────────
// PREVIEW (JSON)
// ──────────────────────────────────────────────

function actionPreview(DesercionService $service, ?int $idAlumno): never
{
    try {
        if ($idAlumno !== null) {
            $data = $service->compilarReporteAlumno($idAlumno);
        } else {
            $data = $service->compilarReporteInstitucional();
        }
        @ob_end_clean();
        sendJson(200, ['ok' => true, 'data' => $data]);
    } catch (InvalidArgumentException $e) {
        sendError(404, $e->getMessage());
    } catch (Exception $e) {
        sendError(500, 'Error al compilar reporte: ' . $e->getMessage());
    }
}

// ──────────────────────────────────────────────
// PDF (Dompdf + Template)
// ──────────────────────────────────────────────

function actionPdf(DesercionService $service, ?int $idAlumno): never
{
    try {
        $download = (bool)getParam('download', false);
        $templateFile = __DIR__ . '/template-desercion.php';

        if (!file_exists($templateFile)) {
            sendError(500, 'Plantilla PDF no encontrada: ' . $templateFile);
        }

        require_once $templateFile;

        if ($idAlumno !== null) {
            $data = $service->compilarReporteAlumno($idAlumno);
        } else {
            $data = $service->compilarReporteInstitucional();
        }

        $templateData = [
            'datos_institucion'   => $data['datos_institucion'],
            'datos_periodo'       => $data['datos_periodo'],
            'datos_alumno'        => $data['datos_alumno'],
            'datos_carrera'       => $data['datos_carrera'],
            'datos_grupo'         => $data['datos_grupo'],
            'fotografia_url'      => $data['fotografia_url'] ?? '',
            'estado_academico'    => $data['estado_academico'],
            'motivo_alerta'       => $data['motivo_alerta'],
            'indicadores_desercion' => $data['indicadores_desercion'],
            'distribucion_riesgo' => $data['distribucion_riesgo'],
            'parciales'           => $data['parciales'],
            'ciclos'              => $data['ciclos'],
            'progresion_temporal' => $data['progresion_temporal'],
            'analisis_carrera'    => $data['analisis_carrera'],
            'materias_criticas'   => $data['materias_criticas'],
            'alertas_recientes'   => $data['alertas_recientes'],
            'resumen_ia'          => $data['resumen_ia'],
            'observaciones'       => $data['observaciones'],
            'recomendaciones'     => $data['recomendaciones'],
            'firmas'              => $data['firmas'],
            'sellos'              => $data['sellos'],
            'folio'               => $data['folio'],
            'fecha_emision'       => $data['fecha_emision'],
            'zona_horaria'        => $data['zona_horaria'],
        ];

        $html = getDesercionTemplate($templateData);

        $dompdfOptions = new Options();
        $dompdfOptions->set('defaultFont', 'Helvetica');
        $dompdfOptions->set('isRemoteEnabled', true);
        $dompdfOptions->set('isHtml5ParserEnabled', true);
        $dompdfOptions->set('isPhpEnabled', false);
        $dompdfOptions->set('logOutputFile', '');
        $dompdfOptions->set('tempDir', sys_get_temp_dir());
        $dompdfOptions->set('chroot', realpath(__DIR__ . '/../..') ?: __DIR__);

        $dompdf = new Dompdf($dompdfOptions);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();
        $pdfOutput = $dompdf->output();

        @ob_end_clean();

        if (PHP_SAPI === 'cli') {
            echo $pdfOutput;
        } else {
            $folio = rawurlencode($data['folio'] ?? 'reporte_desercion');
            header('Content-Type: application/pdf');
            header('Content-Disposition: ' . ($download ? 'attachment' : 'inline') . '; filename="reporte_desercion_' . $folio . '.pdf"');
            header('Content-Length: ' . strlen($pdfOutput));
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header('Pragma: no-cache');
            header('Expires: 0');
            echo $pdfOutput;
        }
        exit;

    } catch (InvalidArgumentException $e) {
        @ob_end_clean();
        sendError(404, $e->getMessage());
    } catch (Exception $e) {
        @ob_end_clean();
        sendError(500, 'Error al generar PDF: ' . $e->getMessage());
    }
}

// ──────────────────────────────────────────────
// EXCEL (PhpSpreadsheet)
// ──────────────────────────────────────────────

function actionExcel(DesercionService $service, ?int $idAlumno): never
{
    try {
        if ($idAlumno !== null) {
            $data = $service->compilarReporteAlumno($idAlumno);
        } else {
            $data = $service->compilarReporteInstitucional();
        }

        $institucion = $data['datos_institucion'];
        $periodo     = $data['datos_periodo'];
        $indicadores = $data['indicadores_desercion'];
        $dist        = $data['distribucion_riesgo'];
        $parciales   = $data['parciales'];
        $ciclos      = $data['ciclos'];
        $progresion  = $data['progresion_temporal'];
        $porCarrera  = $data['analisis_carrera'];
        $porMateria  = $data['materias_criticas'];
        $alertas     = $data['alertas_recientes'];
        $insights    = $data['resumen_ia'];
        $observ      = $data['observaciones'];
        $recom       = $data['recomendaciones'];
        $folio       = $data['folio'];
        $fecha       = $data['fecha_emision'];

        $spreadsheet = new Spreadsheet();
        $spreadsheet->getProperties()
            ->setCreator('SIVACAD')
            ->setTitle('Reporte de Desercion')
            ->setSubject('Reporte Estrategico de Desercion')
            ->setDescription('Reporte generado por SIVACAD')
            ->setCreated(time());

        $colorPrimario = 'FF4F46E5';
        $colorFondoTabla = 'FFF8FAFC';
        $borderStyle = ['style' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']];
        $headerFont = ['bold' => true, 'size' => 9, 'color' => ['argb' => 'FFFFFFFF'], 'name' => 'Arial'];
        $headerFill = ['type' => Fill::FILL_SOLID, 'color' => ['argb' => $colorPrimario]];
        $cellFont   = ['size' => 9, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial'];
        $titleFont  = ['bold' => true, 'size' => 14, 'color' => ['argb' => 'FF0F172A'], 'name' => 'Arial'];
        $sectionFont = ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF1E293B'], 'name' => 'Arial'];

        function colL(int $c): string { return chr(64 + $c); }

        function applyHeader($ws, $row, array $cols): void
        {
            global $headerFont, $headerFill;
            $i = 1;
            foreach ($cols as $c => $label) {
                $cell = colL($i) . $row;
                $ws->setCellValue($cell, $label);
                $ws->getStyle($cell)->applyFromArray(['font' => $headerFont, 'fill' => $headerFill, 'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]]);
                $i++;
            }
        }

        function applyCell($ws, $row, int $cols, array $exceptions = []): void
        {
            global $cellFont;
            for ($i = 1; $i <= $cols; $i++) {
                $cell = colL($i) . $row;
                $ws->getStyle($cell)->applyFromArray(['font' => $cellFont, 'borders' => ['bottom' => ['style' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]]]);
                if (in_array($i, $exceptions)) {
                    $ws->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                } else {
                    $ws->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
                }
            }
        }

        // ===== HOJA 1: RESUMEN EJECUTIVO =====
        $ws1 = $spreadsheet->getActiveSheet();
        $ws1->setTitle('Resumen Ejecutivo');
        foreach (['A' => 32, 'B' => 32, 'C' => 32, 'D' => 32, 'E' => 32, 'F' => 32] as $c => $w) {
            $ws1->getColumnDimension($c)->setWidth($w);
        }
        $ws1->setShowGridlines(false);

        $ws1->mergeCells('A1:F1');
        $ws1->setCellValue('A1', 'SIVACAD - Reporte Estrategico de Riesgo de Desercion');
        $ws1->getStyle('A1')->applyFromArray(['font' => $titleFont]);
        $ws1->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $ws1->getRowDimension(1)->setRowHeight(28);

        $ws1->mergeCells('A2:F2');
        $ws1->setCellValue('A2', 'Periodo: ' . ($periodo['nombre_periodo'] ?? 'N/D') . ' | Generado: ' . $fecha);
        $ws1->getStyle('A2')->applyFromArray(['font' => ['size' => 8, 'italic' => true, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial']]);
        $ws1->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $ws1->setCellValue('A4', 'INDICADORES GENERALES');
        $ws1->getStyle('A4')->applyFromArray(['font' => $sectionFont]);

        $cards = [
            ['A5', 'Alertas Totales',      $indicadores['alertas_totales'] ?? 0,      'FF4F46E5'],
            ['B5', 'Pendientes',            $indicadores['alertas_pendientes'] ?? 0,   'FFF97316'],
            ['C5', 'Atendidas',             $indicadores['alertas_atendidas'] ?? 0,    'FF16A34A'],
            ['D5', 'Tasa Atencion',         ($indicadores['tasa_atencion'] ?? 0) . '%','FF16A34A'],
            ['E5', 'Alumnos',               $indicadores['total_alumnos'] ?? 0,        'FF3B82F6'],
            ['F5', 'Grupos',                $indicadores['total_grupos'] ?? 0,         'FF8B5CF6'],
        ];
        foreach ($cards as $c) {
            $ws1->setCellValue($c[0], $c[1]);
            $ws1->getStyle($c[0])->applyFromArray(['font' => ['bold' => true, 'size' => 8, 'color' => ['argb' => 'FF64748B'], 'name' => 'Arial'], 'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]]);
            $r2 = substr($c[0], 0, 1) . '6';
            $ws1->setCellValue($r2, $c[2]);
            $ws1->getStyle($r2)->applyFromArray(['font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => $c[3]], 'name' => 'Arial'], 'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]]);
        }
        $ws1->getRowDimension(6)->setRowHeight(32);

        $row = 8;
        $ws1->setCellValue('A' . $row, 'DISTRIBUCION DE RIESGO');
        $ws1->getStyle('A' . $row)->applyFromArray(['font' => $sectionFont]);
        $row++;

        $totalDist = 0;
        foreach ($dist as $d) $totalDist += (int)($d['total'] ?? 0);

        applyHeader($ws1, $row, ['A' => 'Nivel', 'B' => 'Total', 'C' => 'Porcentaje']);
        $row++;
        foreach ($dist as $d) {
            $nivel = $d['nivel'] ?? '';
            $totalD = (int)($d['total'] ?? 0);
            $pct = $totalDist > 0 ? round(($totalD / $totalDist) * 100, 1) : 0;
            $ws1->setCellValue('A' . $row, $nivel);
            $ws1->setCellValue('B' . $row, $totalD);
            $ws1->setCellValue('C' . $row, $pct . '%');
            applyCell($ws1, $row, 3, [2, 3]);
            $row++;
        }

        $row++;
        $ws1->setCellValue('A' . $row, 'INSIGHTS ESTRATEGICOS');
        $ws1->getStyle('A' . $row)->applyFromArray(['font' => $sectionFont]);
        $row++;

        foreach ($insights as $ins) {
            $ws1->mergeCells('A' . $row . ':F' . $row);
            $ws1->setCellValue('A' . $row, $ins);
            $ws1->getStyle('A' . $row)->applyFromArray($cellFont);
            $ws1->getStyle('A' . $row)->getAlignment()->setWrapText(true);
            $ws1->getRowDimension($row)->setRowHeight(30);
            $row++;
        }

        // ===== HOJA 2: DATOS TABULADOS =====
        $ws2 = $spreadsheet->createSheet();
        $ws2->setTitle('Datos Tabulados');
        foreach (['A' => 18, 'B' => 18, 'C' => 18, 'D' => 18, 'E' => 18, 'F' => 18, 'G' => 18, 'H' => 18] as $c => $w) {
            $ws2->getColumnDimension($c)->setWidth($w);
        }

        $ws2->mergeCells('A1:H1');
        $ws2->setCellValue('A1', 'SIVACAD - Datos Tabulados de Desercion');
        $ws2->getStyle('A1')->applyFromArray(['font' => $titleFont]);
        $ws2->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $rw = 3;

        if (count($parciales) > 0) {
            $ws2->setCellValue('A' . $rw, 'ANALISIS POR PARCIALES');
            $ws2->getStyle('A' . $rw)->applyFromArray(['font' => $sectionFont]);
            $rw++;
            $colsP = ['A' => 'Parcial', 'B' => 'Promedio', 'C' => 'Riesgos', 'D' => 'Reprob.', 'E' => 'Activos', 'F' => 'Desert.', 'G' => 'Tasa'];
            applyHeader($ws2, $rw, $colsP);
            $rw++;
            foreach ($parciales as $p) {
                $ws2->setCellValue('A' . $rw, 'Parcial ' . ($p['numero_parcial'] ?? ''));
                $ws2->setCellValue('B' . $rw, $p['promedio_general'] ?? 0);
                $ws2->setCellValue('C' . $rw, $p['total_riesgos'] ?? 0);
                $ws2->setCellValue('D' . $rw, $p['total_reprobadas'] ?? 0);
                $ws2->setCellValue('E' . $rw, $p['total_activos'] ?? 0);
                $ws2->setCellValue('F' . $rw, $p['total_desertores'] ?? 0);
                $ws2->setCellValue('G' . $rw, ($p['tasa_desercion'] ?? 0) . '%');
                applyCell($ws2, $rw, 7, [2, 3, 4, 5, 6, 7]);
                $rw++;
            }
            $rw++;
        }

        if (count($ciclos) > 0) {
            $ws2->setCellValue('A' . $rw, 'COMPARATIVA POR CICLOS');
            $ws2->getStyle('A' . $rw)->applyFromArray(['font' => $sectionFont]);
            $rw++;
            $colsC = ['A' => 'Ciclo', 'B' => 'Alertas', 'C' => 'Alto/Critico', 'D' => 'Riesgo Prom.', 'E' => 'Alumnos', 'F' => 'Tasa'];
            applyHeader($ws2, $rw, $colsC);
            $rw++;
            foreach ($ciclos as $c) {
                $ws2->setCellValue('A' . $rw, $c['ciclo'] ?? '');
                $ws2->setCellValue('B' . $rw, $c['alertas'] ?? 0);
                $ws2->setCellValue('C' . $rw, $c['alto_riesgo'] ?? 0);
                $ws2->setCellValue('D' . $rw, $c['riesgo_promedio'] ?? 0);
                $ws2->setCellValue('E' . $rw, $c['total_alumnos'] ?? 0);
                $ws2->setCellValue('F' . $rw, ($c['tasa_desercion'] ?? 0) . '%');
                applyCell($ws2, $rw, 6, [2, 3, 4, 5, 6]);
                $rw++;
            }
            $rw++;
        }

        if (count($progresion) > 0) {
            $ws2->setCellValue('A' . $rw, 'PROGRESION TEMPORAL');
            $ws2->getStyle('A' . $rw)->applyFromArray(['font' => $sectionFont]);
            $rw++;
            $colsT = ['A' => 'Mes', 'B' => 'Bajo', 'C' => 'Medio', 'D' => 'Alto', 'E' => 'Critico', 'F' => 'Total'];
            applyHeader($ws2, $rw, $colsT);
            $rw++;
            foreach ($progresion as $p) {
                $ws2->setCellValue('A' . $rw, $p['mes'] ?? '');
                $ws2->setCellValue('B' . $rw, $p['bajo'] ?? 0);
                $ws2->setCellValue('C' . $rw, $p['medio'] ?? 0);
                $ws2->setCellValue('D' . $rw, $p['alto'] ?? 0);
                $ws2->setCellValue('E' . $rw, $p['critico'] ?? 0);
                $ws2->setCellValue('F' . $rw, $p['total'] ?? 0);
                applyCell($ws2, $rw, 6, [2, 3, 4, 5, 6]);
                $rw++;
            }
            $rw++;
        }

        if (count($porMateria) > 0) {
            $ws2->setCellValue('A' . $rw, 'MATERIAS CRITICAS');
            $ws2->getStyle('A' . $rw)->applyFromArray(['font' => $sectionFont]);
            $rw++;
            $colsM = ['A' => 'Materia', 'B' => 'Eval.', 'C' => 'Promedio', 'D' => 'Reprob.', 'E' => 'Nivel'];
            applyHeader($ws2, $rw, $colsM);
            $rw++;
            foreach ($porMateria as $m) {
                $ws2->setCellValue('A' . $rw, $m['materia'] ?? '');
                $ws2->setCellValue('B' . $rw, $m['alumnos_evaluados'] ?? 0);
                $ws2->setCellValue('C' . $rw, $m['promedio'] ?? 0);
                $ws2->setCellValue('D' . $rw, $m['reprobados'] ?? 0);
                $ws2->setCellValue('E' . $rw, $m['nivel'] ?? '');
                applyCell($ws2, $rw, 5, [2, 3, 4]);
                $rw++;
            }
        }

        // ===== HOJA 3: ALERTAS Y CARRERAS =====
        $ws3 = $spreadsheet->createSheet();
        $ws3->setTitle('Alertas y Carreras');
        foreach (['A' => 8, 'B' => 16, 'C' => 35, 'D' => 14, 'E' => 10, 'F' => 14, 'G' => 14] as $c => $w) {
            $ws3->getColumnDimension($c)->setWidth($w);
        }

        $ws3->mergeCells('A1:G1');
        $ws3->setCellValue('A1', 'SIVACAD - Alertas Recientes de Desercion');
        $ws3->getStyle('A1')->applyFromArray(['font' => $titleFont]);
        $ws3->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $rw = 3;

        if (count($alertas) > 0) {
            $ws3->setCellValue('A' . $rw, 'ALERTAS RECIENTES');
            $ws3->getStyle('A' . $rw)->applyFromArray(['font' => $sectionFont]);
            $rw++;
            $colsA = ['A' => '#', 'B' => 'Matricula', 'C' => 'Alumno', 'D' => 'Riesgo', 'E' => 'Puntaje', 'F' => 'Estado', 'G' => 'Periodo'];
            applyHeader($ws3, $rw, $colsA);
            $rw++;
            $idx = 1;
            foreach ($alertas as $a) {
                $nom = $a['nombre_completo'] ?? trim(($a['nombres'] ?? '') . ' ' . ($a['apellido_paterno'] ?? '') . ' ' . ($a['apellido_materno'] ?? ''));
                $estado = !empty($a['atendida']) ? 'Atendida' : 'Pendiente';
                $ws3->setCellValue('A' . $rw, $idx);
                $ws3->setCellValue('B' . $rw, $a['matricula'] ?? '');
                $ws3->setCellValue('C' . $rw, $nom);
                $ws3->setCellValue('D' . $rw, $a['nivel_riesgo'] ?? '');
                $ws3->setCellValue('E' . $rw, (int)($a['puntaje_riesgo'] ?? 0));
                $ws3->setCellValue('F' . $rw, $estado);
                $ws3->setCellValue('G' . $rw, $a['nombre_periodo'] ?? '');
                applyCell($ws3, $rw, 7, [1, 4, 5]);
                $idx++;
                $rw++;
            }
            $rw++;
        }

        if (count($porCarrera) > 0) {
            $ws3->setCellValue('A' . $rw, 'ANALISIS POR CARRERA');
            $ws3->getStyle('A' . $rw)->applyFromArray(['font' => $sectionFont]);
            $rw++;
            $colsCa = ['A' => 'Carrera', 'B' => 'Alertas', 'C' => 'Alto/Critico', 'D' => 'Pendientes'];
            applyHeader($ws3, $rw, $colsCa);
            $rw++;
            foreach ($porCarrera as $c) {
                $ws3->setCellValue('A' . $rw, $c['carrera'] ?? '');
                $ws3->setCellValue('B' . $rw, $c['total_alertas'] ?? 0);
                $ws3->setCellValue('C' . $rw, $c['alto_riesgo'] ?? 0);
                $ws3->setCellValue('D' . $rw, $c['pendientes'] ?? 0);
                applyCell($ws3, $rw, 4, [2, 3, 4]);
                $rw++;
            }
            $rw++;
        }

        if (count($observ) > 0) {
            $ws3->setCellValue('A' . $rw, 'OBSERVACIONES Y SEGUIMIENTO');
            $ws3->getStyle('A' . $rw)->applyFromArray(['font' => $sectionFont]);
            $rw++;
            $colsO = ['A' => 'Accion', 'B' => 'Observaciones', 'C' => 'Estado', 'D' => 'Responsable'];
            applyHeader($ws3, $rw, $colsO);
            $rw++;
            foreach ($observ as $o) {
                $ws3->setCellValue('A' . $rw, $o['accion'] ?? '');
                $ws3->setCellValue('B' . $rw, $o['observaciones'] ?? '');
                $ws3->setCellValue('C' . $rw, $o['estado'] ?? '');
                $ws3->setCellValue('D' . $rw, $o['usuario_nombre'] ?? '');
                applyCell($ws3, $rw, 4);
                $rw++;
            }
            $rw++;
        }

        if (count($recom) > 0) {
            $ws3->setCellValue('A' . $rw, 'RECOMENDACIONES');
            $ws3->getStyle('A' . $rw)->applyFromArray(['font' => $sectionFont]);
            $rw++;
            foreach ($recom as $r) {
                $ws3->mergeCells('A' . $rw . ':G' . $rw);
                $ws3->setCellValue('A' . $rw, $r);
                $ws3->getStyle('A' . $rw)->applyFromArray($cellFont);
                $ws3->getStyle('A' . $rw)->getAlignment()->setWrapText(true);
                $ws3->getRowDimension($rw)->setRowHeight(24);
                $rw++;
            }
        }

        // Autoajuste de columnas
        foreach ([$ws1, $ws2, $ws3] as $ws) {
            foreach (range('A', 'Z') as $col) {
                try { $ws->getColumnDimension($col)->setAutoSize(true); } catch (Exception $e) { break; }
            }
        }

        $writer = new Xlsx($spreadsheet);
        @ob_end_clean();

        if (PHP_SAPI === 'cli') {
            $writer->save('php://stdout');
        } else {
            $folioEnc = rawurlencode($folio ?? 'reporte_desercion');
            header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            header('Content-Disposition: attachment; filename="reporte_desercion_' . $folioEnc . '.xlsx"');
            header('Cache-Control: max-age=0');
            $writer->save('php://output');
        }
        exit;

    } catch (InvalidArgumentException $e) {
        @ob_end_clean();
        sendError(404, $e->getMessage());
    } catch (Exception $e) {
        @ob_end_clean();
        sendError(500, 'Error al generar Excel: ' . $e->getMessage());
    }
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────

try {
    $accion    = validarAccion((string)getParam('action', ''));
    $idAlumno  = getIntParam('id_alumno');

    $service = new DesercionService();

    match ($accion) {
        'preview' => actionPreview($service, $idAlumno),
        'pdf'     => actionPdf($service, $idAlumno),
        'excel'   => actionExcel($service, $idAlumno),
    };

} catch (Exception $e) {
    @ob_end_clean();
    sendError(500, 'Error interno del controlador: ' . $e->getMessage());
}
