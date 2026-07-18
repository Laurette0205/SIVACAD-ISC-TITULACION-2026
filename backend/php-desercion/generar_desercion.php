<?php
/**
 * generar_desercion.php
 *
 * Generador oficial del PDF del Reporte Estratégico de Riesgo de Deserción.
 * Usa Dompdf + desercion_service.php + template-desercion.php.
 *
 * Uso HTTP:
 *   .../generar_desercion.php
 *   .../generar_desercion.php?download=1
 *   .../generar_desercion.php?id_alumno=42
 *   .../generar_desercion.php?id_alumno=42&download=1
 *
 * Uso CLI:
 *   php generar_desercion.php > reporte.pdf
 *   php generar_desercion.php id_alumno=42 > reporte.pdf
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE);
ini_set('display_errors', '0');
ob_start();

require_once __DIR__ . '/desercion_service.php';
require_once __DIR__ . '/template-desercion.php';
require_once __DIR__ . '/../php-kardex/vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;

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
// GENERACIÓN PDF
// ──────────────────────────────────────────────

try {
    $idAlumno = getIntParam('id_alumno');
    $download = (bool)getParam('download', false);

    $service = new DesercionService();

    if ($idAlumno !== null) {
        $data = $service->compilarReporteAlumno($idAlumno);
    } else {
        $data = $service->compilarReporteInstitucional();
    }

    $templateData = [
        'datos_institucion'     => $data['datos_institucion'],
        'datos_periodo'         => $data['datos_periodo'],
        'datos_alumno'          => $data['datos_alumno'],
        'datos_carrera'         => $data['datos_carrera'],
        'datos_grupo'           => $data['datos_grupo'],
        'fotografia_url'        => $data['fotografia_url'] ?? '',
        'estado_academico'      => $data['estado_academico'],
        'motivo_alerta'         => $data['motivo_alerta'],
        'indicadores_desercion' => $data['indicadores_desercion'],
        'distribucion_riesgo'   => $data['distribucion_riesgo'],
        'parciales'             => $data['parciales'],
        'ciclos'                => $data['ciclos'],
        'progresion_temporal'   => $data['progresion_temporal'],
        'analisis_carrera'      => $data['analisis_carrera'],
        'materias_criticas'     => $data['materias_criticas'],
        'alertas_recientes'     => $data['alertas_recientes'],
        'resumen_ia'            => $data['resumen_ia'],
        'observaciones'         => $data['observaciones'],
        'recomendaciones'       => $data['recomendaciones'],
        'firmas'                => $data['firmas'],
        'sellos'                => $data['sellos'],
        'folio'                 => $data['folio'],
        'fecha_emision'         => $data['fecha_emision'],
        'zona_horaria'          => $data['zona_horaria'],
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
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
        exit(1);
    }
    sendError(500, 'Error al generar PDF: ' . $e->getMessage());
}
