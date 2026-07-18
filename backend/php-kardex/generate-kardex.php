<?php
/**
 * Generador PDF del Kardex Académico - SIVACAD
 * 
 * Uso: php generate-kardex.php [opciones]
 * 
 * Opciones:
 *   --stdin       Leer datos JSON desde STDIN
 *   --data=JSON   Datos JSON inline
 *   --output=RUTA Ruta de salida del PDF (opcional, por defecto stdout)
 * 
 * Ejemplo:
 *   cat data.json | php generate-kardex.php --stdin > kardex.pdf
 *   php generate-kardex.php --data='{"folio":"K-001"}' --output=kardex.pdf
 *   echo '{"folio":"K-001"}' | php generate-kardex.php --stdin --output=kardex.pdf
 */

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/template-kardex.php';

use Dompdf\Dompdf;
use Dompdf\Options;

// ──────────────────────────────────────────────
// 1. OBTENER DATOS
// ──────────────────────────────────────────────
$datosJson = null;

$options = getopt('', ['stdin', 'data::', 'output::']);

if (isset($options['data'])) {
    $datosJson = $options['data'];
} elseif (isset($options['stdin'])) {
    $datosJson = stream_get_contents(STDIN);
} else {
    // Leer desde STDIN si hay pipe
    $stdinIsTty = null;
    if (function_exists('stream_isatty')) {
        $stdinIsTty = stream_isatty(STDIN);
    } elseif (function_exists('posix_isatty')) {
        $stdinIsTty = posix_isatty(STDIN);
    }

    if ($stdinIsTty === false) {
        $datosJson = stream_get_contents(STDIN);
    }
}

$outputPath = $options['output'] ?? null;

if (!$datosJson) {
    fwrite(STDERR, "ERROR: No se recibieron datos. Use --stdin, --data=JSON o pipe.\n");
    exit(1);
}

$data = json_decode($datosJson, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    fwrite(STDERR, "ERROR: JSON inválido: " . json_last_error_msg() . "\n");
    exit(1);
}

// ──────────────────────────────────────────────
// 2. GENERAR HTML
// ──────────────────────────────────────────────
$html = getKardexTemplate($data);

// ──────────────────────────────────────────────
// 3. CONVERTIR A PDF CON DOMPDF
// ──────────────────────────────────────────────
$dompdfOptions = new Options();
$dompdfOptions->set('defaultFont', 'Helvetica');
$dompdfOptions->set('isRemoteEnabled', true);
$dompdfOptions->set('isHtml5ParserEnabled', true);
$dompdfOptions->set('isPhpEnabled', false);
$dompdfOptions->set('logOutputFile', '');

// Para imágenes base64 grandes, aumentar memoria
$dompdfOptions->set('tempDir', sys_get_temp_dir());
$dompdfOptions->set('chroot', realpath(__DIR__ . '/../..') ?: __DIR__);

$dompdf = new Dompdf($dompdfOptions);
$dompdf->loadHtml($html, 'UTF-8');
$dompdf->setPaper('letter', 'portrait');

try {
    $dompdf->render();
} catch (Exception $e) {
    fwrite(STDERR, "ERROR al renderizar PDF: " . $e->getMessage() . "\n");
    exit(1);
}

$pdfOutput = $dompdf->output();

if ($outputPath) {
    file_put_contents($outputPath, $pdfOutput);
    fwrite(STDERR, "PDF generado en: {$outputPath}\n");
} else {
    // Enviar a STDOUT para pipe
    echo $pdfOutput;
}

exit(0);
