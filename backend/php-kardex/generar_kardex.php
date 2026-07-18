<?php
/**
 * generar_kardex.php
 *
 * Endpoint PHP standalone para generar el PDF del Kardex del Alumno.
 * Usa Dompdf + endroid/qr-code + PDO (MySQL).
 *
 * Uso:
 *   http://localhost/SIVACAD-ISC/backend/php-kardex/generar_kardex.php?id_alumno=1
 *   http://localhost/SIVACAD-ISC/backend/php-kardex/generar_kardex.php?id_alumno=1&download=1
 *   php generar_kardex.php --id=1 > kardex.pdf
 */

declare(strict_types=1);

// Suprimir warnings de módulos ya cargados (openssl duplicado en XAMPP)
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE);
ini_set('display_errors', '0');

// Capturar cualquier warning de módulos emitido antes de que el script comience
ob_start();

require_once __DIR__ . '/vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\Writer\PngWriter;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\RoundBlockSizeMode;

// ──────────────────────────────────────────────
// CONFIGURACIÓN
// ──────────────────────────────────────────────
$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = '';
$DB_NAME = 'sivacad_isc';
$DB_PORT = 3306;

// Ruta base de assets (logotipos, watermark, fotos)
$ASSETS_DIR = realpath(__DIR__ . '/../../frontend/src/assets');
$TEMP_DIR = sys_get_temp_dir();

// ──────────────────────────────────────────────
// FUNCIONES AUXILIARES
// ──────────────────────────────────────────────

function dbConnect(): PDO
{
    global $DB_HOST, $DB_USER, $DB_PASS, $DB_NAME, $DB_PORT;
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
        $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

function imgToBase64(string $path): string
{
    if (!$path || !file_exists($path) || !is_readable($path)) {
        return '';
    }
    $data = file_get_contents($path);
    if ($data === false) return '';
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mime = match ($ext) {
        'png'  => 'image/png',
        'jpg', 'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'gif'  => 'image/gif',
        default => 'image/png',
    };
    return 'data:' . $mime . ';base64,' . base64_encode($data);
}

function generarFolio(): string
{
    $now = new DateTime();
    $rand = strtoupper(bin2hex(random_bytes(3)));
    return 'K-' . $now->format('Ymd') . '-' . $rand;
}

function formatFechaMX(?string $date = null): string
{
    if (!$date) $date = 'now';
    try {
        $dt = new DateTime($date, new DateTimeZone('America/Mexico_City'));
    } catch (Exception) {
        $dt = new DateTime('now', new DateTimeZone('America/Mexico_City'));
    }
    $dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    $meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    $d = $dias[(int)$dt->format('w')];
    $m = $meses[(int)$dt->format('n') - 1];
    return $d . ', ' . $dt->format('j') . ' de ' . $m . ' de ' . $dt->format('Y') . ', ' . $dt->format('H:i:s') . ' hrs.';
}

function generarQrBase64(string $data): string
{
    try {
        $qr = new QrCode(
            $data,
            new Encoding('UTF-8'),
            ErrorCorrectionLevel::Medium,
            250,
            10,
            RoundBlockSizeMode::Margin
        );
        $writer = new PngWriter();
        $result = $writer->write($qr);
        return 'data:image/png;base64,' . base64_encode($result->getString());
    } catch (Exception $e) {
        return '';
    }
}

function obtenerDatosAlumno(int $idAlumno): ?array
{
    $pdo = dbConnect();

    $stmt = $pdo->prepare("
        SELECT
            ka.id_kardex,
            ka.id_alumno,
            ka.folio_kardex,
            ka.promedio_general,
            ka.creditos_acumulados,
            ka.estatus,
            ka.foto_institucional,
            ka.url_qr,
            ka.qr_token,
            ka.firma_electronica,
            a.nombres,
            a.apellido_paterno,
            a.apellido_materno,
            a.matricula,
            a.curp,
            a.semestre_actual,
            a.fotografia AS fotografia_alumno,
            c.nombre_carrera
        FROM kardex_alumno ka
        INNER JOIN alumnos a ON a.id_alumno = ka.id_alumno
        LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
        WHERE ka.id_alumno = ?
        LIMIT 1
    ");
    $stmt->execute([$idAlumno]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    return $row;
}

function obtenerHistorial(int $idAlumno): array
{
    $pdo = dbConnect();
    $stmt = $pdo->prepare("
        SELECT
            kh.id_historial,
            kh.calificacion,
            kh.creditos,
            kh.estado,
            kh.tipo_materia,
            kh.observaciones,
            p.nombre_periodo,
            m.nombre_materia,
            m.clave_materia,
            m.creditos AS creditos_materia
        FROM kardex_historial_academico kh
        LEFT JOIN periodos p ON p.id_periodo = kh.id_periodo
        LEFT JOIN materias m ON m.id_materia = kh.id_materia
        WHERE kh.id_alumno = ?
        ORDER BY p.fecha_inicio DESC, kh.creado_en DESC
    ");
    $stmt->execute([$idAlumno]);
    return $stmt->fetchAll();
}

function obtenerSellos(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("SELECT tipo, titulo, descripcion FROM kardex_sellos WHERE activo = 1 LIMIT 3");
    $rows = $stmt->fetchAll();
    if (count($rows) === 0) {
        return [
            ['tipo' => 'sivacad', 'titulo' => 'Sello SIVACAD', 'descripcion' => 'Sello oficial del Sistema Integral de Validación y Control Académico'],
            ['tipo' => 'division_isc', 'titulo' => 'Sello División ISC', 'descripcion' => 'Sello de la División de Ingeniería en Sistemas Computacionales'],
            ['tipo' => 'control_escolar', 'titulo' => 'Sello Control Escolar', 'descripcion' => 'Sello oficial de Control Escolar'],
        ];
    }
    return $rows;
}

function buildFirmaHash(array $data): string
{
    $payload = json_encode([
        'folio'    => $data['folio'],
        'alumno'   => $data['nombre_completo'],
        'matricula'=> $data['matricula'],
        'curp'     => $data['curp'],
        'emitido'  => (new DateTime())->format(DateTime::ATOM),
        'zona'     => 'America/Mexico_City',
        'uuid'     => bin2hex(random_bytes(16)),
    ]);
    return strtoupper(hash('sha256', $payload));
}

// ──────────────────────────────────────────────
// PLANTILLA HTML (compatible Dompdf)
// ──────────────────────────────────────────────

function renderTemplate(array $data): string
{
    $folio     = htmlspecialchars($data['folio'] ?? '—', ENT_QUOTES, 'UTF-8');
    $fecha     = htmlspecialchars($data['fecha_emision'], ENT_QUOTES, 'UTF-8');
    $zona      = htmlspecialchars($data['zona_horaria'], ENT_QUOTES, 'UTF-8');
    $alumno    = $data['alumno'];
    $fotoUrl   = $data['foto_base64'] ?? '';
    $qrUrl     = $data['qr_base64'] ?? '';
    $firmaHash = htmlspecialchars($data['firma_hash'], ENT_QUOTES, 'UTF-8');
    $sellos    = $data['sellos'] ?? [];
    $historial = $data['historial'] ?? [];

    $n  = htmlspecialchars($alumno['nombre_completo'] ?? '—', ENT_QUOTES, 'UTF-8');
    $m  = htmlspecialchars($alumno['matricula'] ?? '—', ENT_QUOTES, 'UTF-8');
    $c  = htmlspecialchars($alumno['curp'] ?? '—', ENT_QUOTES, 'UTF-8');
    $ca = htmlspecialchars($alumno['carrera'] ?? '—', ENT_QUOTES, 'UTF-8');
    $s  = htmlspecialchars((string)($alumno['semestre'] ?? '—'), ENT_QUOTES, 'UTF-8');
    $p  = number_format((float)($alumno['promedio'] ?? 0), 2);
    $cr = htmlspecialchars((string)($alumno['creditos_cubiertos'] ?? '—'), ENT_QUOTES, 'UTF-8');
    $e  = htmlspecialchars($alumno['estatus'] ?? '—', ENT_QUOTES, 'UTF-8');

    // Marcas y logos
    $logo_tecnm  = $data['logo_tecnm'] ?? '';
    $logo_sivacad = $data['logo_sivacad'] ?? '';
    $logo_tesi   = $data['logo_tesi'] ?? '';
    $watermark   = $data['watermark'] ?? '';

    // Sello individual HTML (3 columnas fijas)
    $sello1 = '';
    $sello2 = '';
    $sello3 = '';
    $selloIdx = 0;
    foreach (array_slice($sellos, 0, 3) as $sello) {
        $tit = htmlspecialchars($sello['titulo'] ?? '', ENT_QUOTES, 'UTF-8');
        $des = htmlspecialchars($sello['descripcion'] ?? '', ENT_QUOTES, 'UTF-8');
        $selloBlock = <<<SELLO
        <div style="border-top:1px solid #000000;padding-top:5px;margin:0 10px;">
            <div style="font-size:7pt;font-weight:700;color:#0f172a;">{$tit}</div>
            <div style="font-size:5.5pt;color:#64748b;margin-top:2px;">{$des}</div>
        </div>
SELLO;
        if ($selloIdx === 0) $sello1 = $selloBlock;
        elseif ($selloIdx === 1) $sello2 = $selloBlock;
        else $sello3 = $selloBlock;
        $selloIdx++;
    }

    // Foto HTML
    if ($fotoUrl) {
        $fotoHtml = '<img src="' . $fotoUrl . '" style="width:100%;height:100%;object-fit:cover;" alt="Foto">';
    } else {
        $fotoHtml = '<span style="color:#94a3b8;font-size:5pt;">Foto institucional</span>';
    }

    // QR HTML
    if ($qrUrl) {
        $qrHtml = '<img src="' . $qrUrl . '" style="width:55px;height:55px;" alt="QR">';
    } else {
        $qrHtml = '<span style="color:#94a3b8;font-size:4.5pt;">QR del sistema SIVACAD</span>';
    }

    $wmStyle = $watermark
        ? "background-image: url('{$watermark}');"
        : '';

    // Historial rows con alternancia de color
    $histBodyRows = '';
    $rowIdx = 0;
    foreach ($historial as $h) {
        $periodo = htmlspecialchars($h['periodo'] ?? '—', ENT_QUOTES, 'UTF-8');
        $clave   = htmlspecialchars($h['clave'] ?? '—', ENT_QUOTES, 'UTF-8');
        $materia = htmlspecialchars($h['materia'] ?? '—', ENT_QUOTES, 'UTF-8');
        $calif   = htmlspecialchars((string)($h['calificacion'] ?? '—'), ENT_QUOTES, 'UTF-8');
        $cred    = htmlspecialchars((string)($h['creditos'] ?? '—'), ENT_QUOTES, 'UTF-8');
        $estado  = htmlspecialchars($h['estado'] ?? '—', ENT_QUOTES, 'UTF-8');
        $estadoColor = match (strtolower($estado)) {
            'acreditada'    => '#16a34a',
            'no acreditada' => '#dc2626',
            'cursando'      => '#ca8a04',
            default         => '#334155',
        };
        $bg = ($rowIdx % 2 === 0) ? '#ffffff' : '#f8fafc';
        $histBodyRows .= <<<ROW
        <tr style="background-color:{$bg};">
            <td style="padding:3px 2px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">{$periodo}</td>
            <td style="padding:3px 2px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;"><span style="font-family:'Courier New',monospace;">{$clave}</span></td>
            <td style="padding:3px 2px;border-bottom:1px solid #e2e8f0;font-size:7pt;">{$materia}</td>
            <td style="padding:3px 2px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">{$calif}</td>
            <td style="padding:3px 2px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">{$cred}</td>
            <td style="padding:3px 2px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;color:{$estadoColor};font-weight:700;">{$estado}</td>
        </tr>
ROW;
        $rowIdx++;
    }

    return <<<HTML
<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<style>
    @page { margin: 0.3cm 0.7cm 1.2cm 0.7cm; size: letter; }
    * { margin: 0; padding: 0; }
    body {
        font-family: 'Helvetica', 'Arial', sans-serif;
        font-size: 9pt;
        color: #0f172a;
        line-height: 1.35;
    }
    .watermark {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background-size: 100% 100%;
        background-position: center;
        background-repeat: no-repeat;
        opacity: 0.08;
        z-index: -1;
        pointer-events: none;
        {$wmStyle}
    }
    .fixed-bottom {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #ffffff;
        z-index: 10;
    }
</style>
</head>
<body>

<div class="watermark"></div>

<!-- ============================================= -->
<!-- ZONA A : ENCABEZADO SUPERIOR                  -->
<!-- ============================================= -->

<!-- LOGOS -->
<table style="width:100%;border-collapse:collapse;border:none;">
    <tr>
        <td style="width:33%;text-align:left;vertical-align:middle;border:none;padding:0;">
            <img src="{$logo_tecnm}" style="height:52px;" alt="TecNM">
        </td>
        <td style="width:34%;text-align:center;vertical-align:middle;border:none;padding:0;">
            <img src="{$logo_sivacad}" style="height:52px;" alt="SIVACAD">
        </td>
        <td style="width:33%;text-align:right;vertical-align:middle;border:none;padding:0;">
            <img src="{$logo_tesi}" style="height:52px;" alt="TESI">
        </td>
    </tr>
</table>

<!-- TÍTULO -->
<table style="width:100%;border-collapse:collapse;border:none;margin-top:1px;">
    <tr>
        <td style="text-align:center;font-size:13pt;font-weight:700;color:#0f172a;padding:1px 0;">KARDEX DEL ALUMNO</td>
    </tr>
    <tr>
        <td style="text-align:center;font-size:7pt;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;padding:1px 0;">SISTEMA INTEGRAL DE VALIDACI&Oacute;N Y CONTROL ACAD&Eacute;MICO</td>
    </tr>
</table>

<!-- METADATOS -->
<table style="width:100%;border-collapse:collapse;border:none;margin-top:1px;">
    <tr>
        <td style="text-align:center;font-size:6pt;color:#475569;border-bottom:1px solid #cbd5e1;padding:1px 0 3px 0;">
            Folio: <strong>{$folio}</strong> &nbsp;|&nbsp; Emitido: <strong>{$fecha}</strong> &nbsp;|&nbsp; Zona horaria: <strong>{$zona}</strong>
        </td>
    </tr>
</table>

<!-- ============================================= -->
<!-- ZONA B : CUERPO CENTRAL                      -->
<!-- ============================================= -->

<!-- DATOS DEL ALUMNO + FOTO (LATERAL DERECHA) -->
<table style="width:100%;border-collapse:collapse;border:none;margin-top:3px;">
    <tr>
        <td style="font-size:8.5pt;font-weight:700;color:#1e40af;border-bottom:1.5px solid #1e40af;padding-bottom:2px;text-transform:uppercase;">DATOS DEL ALUMNO</td>
    </tr>
</table>

<table style="width:100%;border-collapse:collapse;border:none;margin-top:3px;">
    <tr>
        <!-- COLUMNA IZQUIERDA — DATOS DEL ALUMNO -->
        <td style="width:65%;vertical-align:top;border:none;padding-right:10px;">
            <table style="width:100%;border-collapse:collapse;border:none;font-size:7.5pt;">
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Nombre Completo:</td><td style="color:#334155;padding:1px 0;">{$n}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Matr&iacute;cula:</td><td style="color:#334155;padding:1px 0;">{$m}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">CURP:</td><td style="color:#334155;padding:1px 0;">{$c}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Carrera:</td><td style="color:#334155;padding:1px 0;">{$ca}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Semestre:</td><td style="color:#334155;padding:1px 0;">{$s}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Promedio General:</td><td style="color:#334155;padding:1px 0;">{$p}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Cr&eacute;ditos cubiertos:</td><td style="color:#334155;padding:1px 0;">{$cr}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Estatus:</td><td style="font-weight:700;color:#16a34a;padding:1px 0;">{$e}</td></tr>
            </table>
        </td>

        <!-- COLUMNA DERECHA — FOTO + QR + FIRMA (alineado a la derecha) -->
        <td style="width:35%;vertical-align:top;text-align:right;border:none;">
            <table style="border-collapse:collapse;margin-left:auto;">
                <tr>
                    <td style="width:5cm;height:2.5cm;border:1.5px solid #cbd5e1;text-align:center;vertical-align:middle;background:#f8fafc;">
                        {$fotoHtml}
                    </td>
                </tr>
            </table>
            <table style="border-collapse:collapse;margin-left:auto;margin-top:3px;">
                <tr>
                    <td style="text-align:center;">{$qrHtml}</td>
                </tr>
            </table>
            <table style="width:5cm;border-collapse:collapse;border:none;margin-left:auto;margin-top:2px;">
                <tr>
                    <td style="text-align:center;border-top:1px solid #94a3b8;padding-top:2px;">
                        <div style="font-weight:700;font-size:5.5pt;color:#334155;">FIRMA ELECTR&Oacute;NICA</div>
                        <div style="font-size:4.5pt;color:#64748b;word-break:break-all;font-family:'Courier New',monospace;margin-top:1px;">{$firmaHash}</div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>

<!-- HISTORIAL ACADÉMICO -->
<table style="width:100%;border-collapse:collapse;border:none;margin-top:5px;">
    <tr>
        <td style="font-size:8.5pt;font-weight:700;color:#1e40af;border-bottom:1.5px solid #1e40af;padding-bottom:2px;text-transform:uppercase;">HISTORIAL ACAD&Eacute;MICO</td>
    </tr>
</table>

<table style="width:100%;border-collapse:collapse;margin-top:2px;">
    <thead>
        <tr style="background-color:#1e40af;">
            <th style="color:#ffffff;padding:3px 2px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Per&iacute;odo</th>
            <th style="color:#ffffff;padding:3px 2px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Clave</th>
            <th style="color:#ffffff;padding:3px 2px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Materia</th>
            <th style="color:#ffffff;padding:3px 2px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Calif.</th>
            <th style="color:#ffffff;padding:3px 2px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Cr&eacute;d.</th>
            <th style="color:#ffffff;padding:3px 2px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Estado</th>
        </tr>
    </thead>
    <tbody>
        {$histBodyRows}
    </tbody>
</table>

<!-- NOTA SIGAA -->
<table style="width:100%;border-collapse:collapse;border:none;margin-top:5px;">
    <tr>
        <td style="font-size:6pt;color:#475569;text-align:justify;border-top:1px solid #cbd5e1;padding-top:3px;line-height:1.4;">
            Si quieres visualizar o verificar qu&eacute; materias acreditaste, est&aacute;s en 2da oportunidad, si est&aacute;s en
            recurse o te fuiste a materia especial, visita la plataforma oficial SIGAA (Sistema Integral de
            Gesti&oacute;n Acad&eacute;mica y Administrativa) para m&aacute;s informaci&oacute;n. El link de la plataforma oficial es el
            siguiente: <strong>https://sigaa.tesi.org.mx/index.php</strong>
        </td>
    </tr>
</table>

<div class="fixed-bottom">

<!-- SELLOS — BANDA INFERIOR ORDENADA -->
<table style="width:100%;border-collapse:collapse;border:none;">
    <tr>
        <td style="width:33.3%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">
            {$sello1}
        </td>
        <td style="width:33.3%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">
            {$sello2}
        </td>
        <td style="width:33.3%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">
            {$sello3}
        </td>
    </tr>
</table>

<!-- PIE DE PÁGINA -->
<table style="width:100%;border-collapse:collapse;border:none;">
    <tr>
        <td style="text-align:center;font-size:5pt;color:#94a3b8;border-top:1px solid #cbd5e1;padding:2px 0;">
            Documento generado electr&oacute;nicamente el {$fecha} &nbsp;|&nbsp; Folio: {$folio} &nbsp;|&nbsp;
            Zona horaria: {$zona} &nbsp;|&nbsp; SIVACAD
        </td>
    </tr>
</table>

</div>

</body>
</html>
HTML;
}

// ──────────────────────────────────────────────
// MANEJO DE ERRORES
// ──────────────────────────────────────────────

function sendError(int $code, string $message): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────

try {
    // 1. Validar parámetro id_alumno (GET, POST, o CLI argv)
    if (PHP_SAPI === 'cli') {
        $opts = getopt('', ['id::']);
        $idAlumno = isset($opts['id']) ? (int)$opts['id'] : 0;
        if ($idAlumno <= 0) {
            global $argv;
            foreach ($argv as $arg) {
                if (str_starts_with($arg, 'id_alumno=')) {
                    $idAlumno = (int)substr($arg, 10);
                    break;
                }
            }
        }
    } else {
        $idAlumno = isset($_GET['id_alumno']) ? (int)$_GET['id_alumno'] : 0;
    }

    if ($idAlumno <= 0) {
        $mensaje = 'Parámetro id_alumno inválido o ausente.';
        if (PHP_SAPI === 'cli') {
            fwrite(STDERR, "Uso: php generar_kardex.php --id=1\n");
            fwrite(STDERR, "     php generar_kardex.php id_alumno=1\n");
            fwrite(STDERR, "Error: {$mensaje}\n");
            exit(1);
        }
        sendError(400, $mensaje);
    }

    if (PHP_SAPI === 'cli') {
        $download = true;
    } else {
        $download = isset($_GET['download']);
    }

    // 2. Obtener datos del alumno
    $alumnoRow = obtenerDatosAlumno($idAlumno);
    if (!$alumnoRow) {
        sendError(404, 'No se encontró el alumno con id ' . $idAlumno);
    }

    // 3. Generar folio si no existe
    $folio = $alumnoRow['folio_kardex'] ?: generarFolio();
    if (!$alumnoRow['folio_kardex']) {
        $pdo = dbConnect();
        $upd = $pdo->prepare("UPDATE kardex_alumno SET folio_kardex = ? WHERE id_alumno = ?");
        $upd->execute([$folio, $idAlumno]);
    }

    // 4. Construir datos estructurados
    $nombres = trim("{$alumnoRow['nombres']} {$alumnoRow['apellido_paterno']} {$alumnoRow['apellido_materno']}");
    $fechaEmision = formatFechaMX();
    $zonaHoraria = 'America/Mexico_City';
    $creditosCubiertos = (float)($alumnoRow['creditos_acumulados'] ?? 0);
    $promedio = (float)($alumnoRow['promedio_general'] ?? 0);
    $estatus = $alumnoRow['estatus'] ?? 'Vigente';

    // 5. Obtener historial y sellos
    $historialDB = obtenerHistorial($idAlumno);
    $sellosDB = obtenerSellos();

    // 6. Generar firma hash
    $firmaHash = buildFirmaHash([
        'folio'          => $folio,
        'nombre_completo'=> $nombres,
        'matricula'      => $alumnoRow['matricula'],
        'curp'           => $alumnoRow['curp'] ?? '',
    ]);

    // 7. Guardar firma si no existe
    if (!$alumnoRow['firma_electronica']) {
        $pdo = dbConnect();
        $upd = $pdo->prepare("UPDATE kardex_alumno SET firma_electronica = ? WHERE id_alumno = ?");
        $upd->execute([$firmaHash, $idAlumno]);
    } else {
        $firmaHash = $alumnoRow['firma_electronica'];
    }

    // 8. Logos y watermark
    $logo_tecnm  = imgToBase64($ASSETS_DIR . '/Logo-TecNM.png') ?: '';
    $logo_sivacad = imgToBase64($ASSETS_DIR . '/Logo-SIVACAD.jpeg') ?: '';
    $logo_tesi   = imgToBase64($ASSETS_DIR . '/Logo-TESI.png') ?: '';
    $watermark   = imgToBase64($ASSETS_DIR . '/marcadeagua_SIVACAD.jpeg') ?: '';

    // 9. Foto institucional
    $fotoBase64 = '';
    $fotoPath = $alumnoRow['foto_institucional'] ?? $alumnoRow['fotografia_alumno'] ?? '';
    if ($fotoPath) {
        if (file_exists($fotoPath)) {
            $fotoBase64 = imgToBase64($fotoPath);
        } elseif (filter_var($fotoPath, FILTER_VALIDATE_URL)) {
            $ctx = stream_context_create(['http' => ['timeout' => 5]]);
            $content = @file_get_contents($fotoPath, false, $ctx);
            if ($content !== false) {
                $fotoBase64 = 'data:image/jpeg;base64,' . base64_encode($content);
            }
        }
    }

    // 10. QR
    $qrBase64 = '';
    $qrContent = $alumnoRow['url_qr'] ?: 'https://sivacad.tesi.org.mx/verificar?token=' . ($alumnoRow['qr_token'] ?? '');
    if ($qrContent && filter_var($qrContent, FILTER_VALIDATE_URL)) {
        $qrBase64 = generarQrBase64($qrContent);
    }

    // 11. Datos para la plantilla
    $historialRows = [];
    foreach ($historialDB as $h) {
        $historialRows[] = [
            'periodo'      => $h['nombre_periodo'] ?? '—',
            'clave'        => $h['clave_materia'] ?? '—',
            'materia'      => $h['nombre_materia'] ?? '—',
            'calificacion' => $h['calificacion'] !== null ? number_format((float)$h['calificacion'], 1) : '—',
            'creditos'     => $h['creditos'] ?? $h['creditos_materia'] ?? 0,
            'estado'       => $h['estado'] ?? '—',
        ];
    }

    $alumnoData = [
        'nombre_completo'  => $nombres,
        'matricula'        => $alumnoRow['matricula'],
        'curp'             => $alumnoRow['curp'] ?? '—',
        'carrera'          => $alumnoRow['nombre_carrera'] ?? '—',
        'semestre'         => $alumnoRow['semestre_actual'] ?? '—',
        'promedio'         => $promedio,
        'creditos_cubiertos' => $creditosCubiertos,
        'estatus'          => $estatus,
    ];

    $templateData = [
        'folio'         => $folio,
        'fecha_emision' => $fechaEmision,
        'zona_horaria'  => $zonaHoraria,
        'alumno'        => $alumnoData,
        'logo_tecnm'    => $logo_tecnm,
        'logo_sivacad'  => $logo_sivacad,
        'logo_tesi'     => $logo_tesi,
        'watermark'     => $watermark,
        'foto_base64'   => $fotoBase64,
        'qr_base64'     => $qrBase64,
        'firma_hash'    => $firmaHash,
        'sellos'        => $sellosDB,
        'historial'     => $historialRows,
    ];

    // 12. Generar HTML
    $html = renderTemplate($templateData);

    // 13. Generar PDF con Dompdf
    $dompdfOptions = new Options();
    $dompdfOptions->set('defaultFont', 'Helvetica');
    $dompdfOptions->set('isRemoteEnabled', false);
    $dompdfOptions->set('isHtml5ParserEnabled', true);
    $dompdfOptions->set('isPhpEnabled', false);
    $dompdfOptions->set('logOutputFile', '');
    $dompdfOptions->set('tempDir', $TEMP_DIR);
    $dompdfOptions->set('chroot', realpath(__DIR__ . '/../..') ?: __DIR__);

    $dompdf = new Dompdf($dompdfOptions);
    $dompdf->loadHtml($html, 'UTF-8');
    $dompdf->setPaper('letter', 'portrait');
    $dompdf->render();

    // 14. Enviar PDF
    $pdfOutput = $dompdf->output();

    // Descartar cualquier warning emitido antes del script (openssl duplicado en XAMPP)
    @ob_end_clean();

    if (PHP_SAPI !== 'cli') {
        header('Content-Type: application/pdf');
        header('Content-Length: ' . strlen($pdfOutput));
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        if ($download) {
            $filename = 'kardex_' . rawurlencode($folio) . '.pdf';
            header('Content-Disposition: attachment; filename="' . $filename . '"');
        } else {
            header('Content-Disposition: inline; filename="kardex_' . rawurlencode($folio) . '.pdf"');
        }
    }

    echo $pdfOutput;

} catch (PDOException $e) {
    @ob_end_clean();
    sendError(500, 'Error de base de datos: ' . $e->getMessage());
} catch (Exception $e) {
    @ob_end_clean();
    sendError(500, 'Error interno: ' . $e->getMessage());
}
