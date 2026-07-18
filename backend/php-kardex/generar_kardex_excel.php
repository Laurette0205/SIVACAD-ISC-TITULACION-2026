<?php
declare(strict_types=1);

error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE);
ini_set('display_errors', '0');

// Output buffering para capturar cualquier warning de módulos (openssl duplicado en XAMPP)
// que PHP emite a stdout antes de que el script comience a ejecutarse.
ob_start();

require_once __DIR__ . '/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = '';
$DB_NAME = 'sivacad_isc';
$DB_PORT = 3306;
$ASSETS_DIR = realpath(__DIR__ . '/../../frontend/src/assets');

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

function obtenerDatosAlumno(int $idAlumno): ?array
{
    $pdo = dbConnect();
    $stmt = $pdo->prepare("
        SELECT
            ka.id_kardex, ka.id_alumno, ka.folio_kardex,
            ka.promedio_general, ka.creditos_acumulados, ka.estatus,
            ka.foto_institucional, ka.url_qr, ka.qr_token, ka.firma_electronica,
            a.nombres, a.apellido_paterno, a.apellido_materno,
            a.matricula, a.curp, a.semestre_actual,
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
    return $row ?: null;
}

function obtenerHistorial(int $idAlumno): array
{
    $pdo = dbConnect();
    $stmt = $pdo->prepare("
        SELECT
            kh.calificacion, kh.creditos, kh.estado,
            p.nombre_periodo, m.nombre_materia, m.clave_materia, m.creditos AS creditos_materia
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
            ['tipo' => 'sivacad',        'titulo' => 'Sello SIVACAD',         'descripcion' => 'Sello oficial del Sistema Integral de Validación y Control Académico'],
            ['tipo' => 'division_isc',   'titulo' => 'Sello División ISC',    'descripcion' => 'Sello de la División de Ingeniería en Sistemas Computacionales'],
            ['tipo' => 'control_escolar','titulo' => 'Sello Control Escolar', 'descripcion' => 'Sello oficial de Control Escolar'],
        ];
    }
    return $rows;
}

function colLetter(int $col): string
{
    static $map = [1=>'A',2=>'B',3=>'C',4=>'D',5=>'E',6=>'F',7=>'G',8=>'H',9=>'I'];
    return $map[$col] ?? 'A';
}

/**
 * Add an image to a worksheet.
 *
 * @param object $spreadsheet Spreadsheet instance.
 */
function addImageToSheet($spreadsheet, string $filePath, string $sheetName, int $col, int $row, int $width, int $height): void
{
    if (!$filePath || !file_exists($filePath)) return;
    try {
        $drawing = new Drawing();
        $drawing->setPath($filePath);
        $drawing->setCoordinates(colLetter($col) . $row);
        $drawing->setWidth($width);
        $drawing->setHeight($height);
        $drawing->setOffsetX(5);
        $drawing->setOffsetY(3);
        $drawing->setWorksheet($spreadsheet->getSheetByName($sheetName));
    } catch (Exception $e) { /* skip image */ }
}

function generateKardexExcel(int $idAlumno): array
{
    global $ASSETS_DIR;

    $alumnoRow = obtenerDatosAlumno($idAlumno);
    if (!$alumnoRow) {
        throw new RuntimeException('Alumno no encontrado con id ' . $idAlumno);
    }

    $folio = $alumnoRow['folio_kardex'] ?: generarFolio();
    if (!$alumnoRow['folio_kardex']) {
        $pdo = dbConnect();
        $upd = $pdo->prepare("UPDATE kardex_alumno SET folio_kardex = ? WHERE id_alumno = ?");
        $upd->execute([$folio, $idAlumno]);
    }

    $nombres = trim("{$alumnoRow['nombres']} {$alumnoRow['apellido_paterno']} {$alumnoRow['apellido_materno']}");
    $fechaEmision = formatFechaMX();
    $zonaHoraria = 'America/Mexico_City';
    $creditosCubiertos = (float)($alumnoRow['creditos_acumulados'] ?? 0);
    $promedio = (float)($alumnoRow['promedio_general'] ?? 0);
    $estatus = $alumnoRow['estatus'] ?? 'Vigente';
    $historialDB = obtenerHistorial($idAlumno);
    $sellosDB = obtenerSellos();

    $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
    $spreadsheet->getProperties()
        ->setCreator('SIVACAD')
        ->setTitle('KARDEX DEL ALUMNO')
        ->setSubject("Kardex - {$nombres}")
        ->setDescription('Kardex del Alumno generado por SIVACAD')
        ->setCreated(time());

    // ─── HOJA 1: RESUMEN ────────────────────────────────────
    $ws = $spreadsheet->getActiveSheet();
    $ws->setTitle('Kardex del Alumno');

    $colWidths = [3, 22, 55, 15, 15, 15, 15, 15, 15];
    foreach ($colWidths as $i => $w) {
        $ws->getColumnDimension(chr(65 + $i))->setWidth($w);
    }
    $ws->setShowGridlines(false);

    // Estilos base
    $boldFont = ['bold' => true, 'name' => 'Arial'];
    $primaryColor = 'FF1E40AF';
    $darkColor = 'FF0F172A';
    $mutedColor = 'FF64748B';

    // ── LOGOS ──
    $logo_tecnm_path  = $ASSETS_DIR . '/Logo-TecNM.png';
    $logo_tesi_path   = $ASSETS_DIR . '/Logo-TESI.png';
    $logo_sivacad_path = $ASSETS_DIR . '/Logo-SIVACAD.jpeg';

    if (file_exists($logo_tecnm_path)) {
        try {
            $d = new Drawing();
            $d->setPath($logo_tecnm_path);
            $d->setCoordinates('A1');
            $d->setWidth(70);
            $d->setHeight(35);
            $d->setOffsetX(3);
            $d->setOffsetY(3);
            $d->setWorksheet($ws);
        } catch (Exception $e) {}
    }
    if (file_exists($logo_sivacad_path)) {
        try {
            $d = new Drawing();
            $d->setPath($logo_sivacad_path);
            $d->setCoordinates('D1');
            $d->setWidth(65);
            $d->setHeight(32);
            $d->setOffsetX(3);
            $d->setOffsetY(3);
            $d->setWorksheet($ws);
        } catch (Exception $e) {}
    }
    if (file_exists($logo_tesi_path)) {
        try {
            $d = new Drawing();
            $d->setPath($logo_tesi_path);
            $d->setCoordinates('G1');
            $d->setWidth(70);
            $d->setHeight(35);
            $d->setOffsetX(3);
            $d->setOffsetY(3);
            $d->setWorksheet($ws);
        } catch (Exception $e) {}
    }
    $ws->getRowDimension(1)->setRowHeight(42);

    // ── TITULO ──
    $ws->mergeCells('A3:I3');
    $ws->setCellValue('A3', 'KARDEX DEL ALUMNO');
    $ws->getStyle('A3')->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 18, 'color' => ['argb' => $darkColor]]),
        'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
    ]);
    $ws->getRowDimension(3)->setRowHeight(30);

    // ── SUBTITULO ──
    $ws->mergeCells('A4:I4');
    $ws->setCellValue('A4', 'SISTEMA INTEGRAL DE VALIDACIÓN Y CONTROL ACADÉMICO');
    $ws->getStyle('A4')->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 10, 'color' => ['argb' => $primaryColor]]),
        'alignment' => ['horizontal' => 'center'],
    ]);
    $ws->getRowDimension(4)->setRowHeight(18);

    // ── METADATOS ──
    $ws->mergeCells('A5:I5');
    $ws->setCellValue('A5', "Folio: {$folio}  |  Emitido: {$fechaEmision}  |  Zona horaria: {$zonaHoraria}");
    $ws->getStyle('A5')->applyFromArray([
        'font' => ['size' => 8, 'color' => ['argb' => 'FF475569'], 'name' => 'Arial'],
        'alignment' => ['horizontal' => 'center'],
    ]);
    $ws->getRowDimension(5)->setRowHeight(16);

    // ── DATOS DEL ALUMNO (con foto en columnas F-I) ──
    $ws->mergeCells('A7:A8');
    $ws->setCellValue('A7', 'DATOS DEL ALUMNO');
    $ws->getStyle('A7')->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 12, 'color' => ['argb' => $primaryColor]]),
        'alignment' => ['vertical' => 'center'],
    ]);

    // Borde inferior azul en header
    $ws->getStyle('A7:I8')->applyFromArray([
        'borders' => ['bottom' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => $primaryColor]]],
    ]);

    // Celda foto (columnas F-I, filas 7-12)
    $ws->mergeCells('F7:I12');

    // Buscar foto del alumno
    $fotoPath = $alumnoRow['foto_institucional'] ?? $alumnoRow['fotografia_alumno'] ?? '';
    if ($fotoPath && file_exists($fotoPath)) {
        try {
            $d = new Drawing();
            $d->setPath($fotoPath);
            $d->setCoordinates('F7');
            $d->setWidth(140);
            $d->setHeight(170);
            $d->setOffsetX(5);
            $d->setOffsetY(3);
            $d->setWorksheet($ws);
        } catch (Exception $e) {
            $ws->setCellValue('F7', 'Foto institucional');
            $ws->getStyle('F7')->applyFromArray([
                'font' => ['size' => 7, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial', 'italic' => true],
        'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
            ]);
        }
    } else {
        $ws->setCellValue('F7', 'Foto institucional');
        $ws->getStyle('F7')->applyFromArray([
            'font' => ['size' => 7, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial', 'italic' => true],
            'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
        ]);
    }
    $ws->getStyle('F7:I12')->applyFromArray([
        'borders' => ['outline' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFCBD5E1']]],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF8FAFC']],
    ]);

    $datFields = [
        ['Nombre Completo:', $nombres],
        ['Matrícula:', $alumnoRow['matricula']],
        ['CURP:', $alumnoRow['curp'] ?: '—'],
        ['Carrera:', $alumnoRow['nombre_carrera'] ?: '—'],
        ['Semestre:', (string)($alumnoRow['semestre_actual'] ?: '—')],
        ['Promedio General:', number_format($promedio, 2)],
        ['Créditos cubiertos:', (string)$creditosCubiertos],
        ['Estatus:', $estatus],
    ];

    $r = 10;
    foreach ($datFields as [$label, $value]) {
        $ws->setCellValue("B{$r}", $label);
        $ws->getStyle("B{$r}")->applyFromArray([
            'font' => array_merge($boldFont, ['size' => 10, 'color' => ['argb' => $darkColor]]),
            'alignment' => ['vertical' => 'center'],
        ]);

        $ws->setCellValue("C{$r}", $value);
        $styleValue = ['font' => ['size' => 10, 'color' => ['argb' => 'FF334155'], 'name' => 'Arial']];

        if ($label === 'Estatus:') {
            $styleValue['font']['bold'] = true;
            $styleValue['font']['color'] = ['argb' => 'FF16A34A'];
        }

        $ws->getStyle("C{$r}")->applyFromArray($styleValue + ['alignment' => ['vertical' => 'center']]);
        $ws->getRowDimension($r)->setRowHeight(18);
        $r++;
    }

    // ── QR + FIRMA (debajo de la foto, col F-I) ──
    // Crear contenido QR como texto si no se puede generar imagen
    $qrContent = $alumnoRow['url_qr'] ?: 'https://sivacad.tesi.org.mx/verificar?token=' . ($alumnoRow['qr_token'] ?? '');
    $ws->setCellValue('F13', 'QR del sistema SIVACAD');
    $ws->getStyle('F13')->applyFromArray([
        'font' => ['size' => 6, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial', 'italic' => true],
        'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
    ]);

    $ws->mergeCells('F14:I14');
    $ws->setCellValue('F14', 'FIRMA ELECTRÓNICA');
    $ws->getStyle('F14')->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 7, 'color' => ['argb' => 'FF334155']]),
        'alignment' => ['horizontal' => 'center'],
        'borders' => ['top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF94A3B8']]],
    ]);

    $firmaElectronica = $alumnoRow['firma_electronica'] ?: hash('sha256', $folio . $nombres . time());
    $ws->mergeCells('F15:I15');
    $ws->setCellValue('F15', $firmaElectronica);
    $ws->getStyle('F15')->applyFromArray([
        'font' => ['size' => 5, 'color' => ['argb' => 'FF64748B'], 'name' => 'Courier New'],
        'alignment' => ['horizontal' => 'center', 'wrapText' => true],
    ]);
    $ws->getRowDimension(15)->setRowHeight(20);

    // ── HISTORIAL ACADEMICO ──
    $histStartRow = 18;
    $ws->mergeCells("A{$histStartRow}:I{$histStartRow}");
    $ws->setCellValue("A{$histStartRow}", 'HISTORIAL ACADÉMICO');
    $ws->getStyle("A{$histStartRow}")->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 12, 'color' => ['argb' => $primaryColor]]),
    ]);
    $ws->getRowDimension($histStartRow)->setRowHeight(20);

    $headerRow = $histStartRow + 1;
    $histHeaders = ['', 'Período', 'Clave', 'Materia', 'Calif.', 'Créd.', 'Estado'];
    $colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    foreach ($histHeaders as $i => $h) {
        $cell = $colLetters[$i] . $headerRow;
        $ws->setCellValue($cell, $h);
        $ws->getStyle($cell)->applyFromArray([
            'font' => array_merge($boldFont, ['size' => 10, 'color' => ['argb' => 'FFFFFFFF']]),
            'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $primaryColor]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
        ]);
    }
    $ws->getRowDimension($headerRow)->setRowHeight(22);

    $dr = $headerRow + 1;
    if (count($historialDB) === 0) {
        $ws->mergeCells("A{$dr}:G{$dr}");
        $ws->setCellValue("A{$dr}", 'No se encontraron materias registradas en el historial académico.');
        $ws->getStyle("A{$dr}")->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial', 'italic' => true],
            'alignment' => ['horizontal' => 'center'],
        ]);
        $dr++;
    } else {
        foreach ($historialDB as $h) {
            $periodo = $h['nombre_periodo'] ?? '—';
            $clave = $h['clave_materia'] ?? '—';
            $materia = $h['nombre_materia'] ?? '—';
            $calif = $h['calificacion'] !== null ? number_format((float)$h['calificacion'], 1) : '—';
            $cred = $h['creditos'] ?? $h['creditos_materia'] ?? 0;
            $estado = $h['estado'] ?? '—';

            $estadoColor = match (strtolower($estado)) {
                'acreditada'    => 'FF16A34A',
                'no acreditada' => 'FFDC2626',
                'cursando'      => 'FFCA8A04',
                default         => 'FF64748B',
            };

            $bgColor = ($dr % 2 === 0) ? 'FFF8FAFC' : 'FFFFFFFF';

            $vals = ['', $periodo, $clave, $materia, $calif, $cred, $estado];
            foreach ($vals as $ci => $val) {
                $cell = $colLetters[$ci] . $dr;
                $ws->setCellValue($cell, $val);
                $fontColor = ($ci === 6) ? $estadoColor : 'FF334155';
                $isBold = ($ci === 6 && strtolower($estado) === 'acreditada');
                $ws->getStyle($cell)->applyFromArray([
                    'font' => ['size' => 9, 'color' => ['argb' => $fontColor], 'name' => 'Arial', 'bold' => $isBold],
                    'alignment' => ['vertical' => 'center', 'horizontal' => $ci <= 1 ? 'left' : 'center'],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $bgColor]],
                    'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
                ]);
            }
            $ws->getRowDimension($dr)->setRowHeight(20);
            $dr++;
        }
    }

    // ── NOTA SIGAA ──
    $dr++;
    $ws->mergeCells("A{$dr}:I{$dr}");
    $ws->setCellValue("A{$dr}", 'Si quieres visualizar o verificar qué materias acreditaste, estás en 2da oportunidad, si estás en recurse o te fuiste a materia especial, visita la plataforma oficial SIGAA (Sistema Integral de Gestión Académica y Administrativa) para más información. El link de la plataforma oficial es el siguiente: https://sigaa.tesi.org.mx/index.php');
    $ws->getStyle("A{$dr}")->applyFromArray([
        'font' => ['size' => 8, 'color' => ['argb' => 'FF475569'], 'name' => 'Arial'],
        'alignment' => ['wrapText' => true, 'vertical' => 'top'],
    ]);
    $ws->getRowDimension($dr)->setRowHeight(40);

    // ── SELLOS ──
    $dr += 2;
    $ws->mergeCells("A{$dr}:I{$dr}");
    $ws->setCellValue("A{$dr}", 'SELLOS INSTITUCIONALES');
    $ws->getStyle("A{$dr}")->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 10, 'color' => ['argb' => $darkColor]]),
    ]);
    $dr++;

    $selloStartRow = $dr;
    $ws->setCellValue("A{$dr}", '');
    $ws->setCellValue("B{$dr}", 'Sello SIVACAD');
    $ws->setCellValue("D{$dr}", 'Sello División ISC');
    $ws->setCellValue("F{$dr}", 'Sello Control Escolar');
    $ws->getStyle("B{$dr}")->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 9, 'color' => ['argb' => $darkColor]]),
        'alignment' => ['horizontal' => 'center'],
        'borders' => ['top' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF000000']]],
    ]);
    $ws->getStyle("D{$dr}")->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 9, 'color' => ['argb' => $darkColor]]),
        'alignment' => ['horizontal' => 'center'],
        'borders' => ['top' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF000000']]],
    ]);
    $ws->getStyle("F{$dr}")->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 9, 'color' => ['argb' => $darkColor]]),
        'alignment' => ['horizontal' => 'center'],
        'borders' => ['top' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF000000']]],
    ]);
    $ws->mergeCells("B{$dr}:C{$dr}");
    $ws->mergeCells("D{$dr}:E{$dr}");
    $ws->mergeCells("F{$dr}:G{$dr}");
    $ws->getRowDimension($dr)->setRowHeight(20);

    $dr++;
    $ws->setCellValue("B{$dr}", 'Sello oficial del Sistema Integral de Validación y Control Académico');
    $ws->setCellValue("D{$dr}", 'Sello de la División de Ingeniería en Sistemas Computacionales');
    $ws->setCellValue("F{$dr}", 'Sello oficial de Control Escolar');
    $ws->getStyle("B{$dr}")->applyFromArray([
        'font' => ['size' => 7, 'color' => ['argb' => $mutedColor], 'name' => 'Arial'],
        'alignment' => ['horizontal' => 'center', 'wrapText' => true],
        'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']]],
    ]);
    $ws->getStyle("D{$dr}")->applyFromArray([
        'font' => ['size' => 7, 'color' => ['argb' => $mutedColor], 'name' => 'Arial'],
        'alignment' => ['horizontal' => 'center', 'wrapText' => true],
        'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']]],
    ]);
    $ws->getStyle("F{$dr}")->applyFromArray([
        'font' => ['size' => 7, 'color' => ['argb' => $mutedColor], 'name' => 'Arial'],
        'alignment' => ['horizontal' => 'center', 'wrapText' => true],
        'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']]],
    ]);
    $ws->mergeCells("B{$dr}:C{$dr}");
    $ws->mergeCells("D{$dr}:E{$dr}");
    $ws->mergeCells("F{$dr}:G{$dr}");
    $ws->getRowDimension($dr)->setRowHeight(28);

    // ── FOOTER ──
    $dr += 2;
    $ws->mergeCells("A{$dr}:I{$dr}");
    $ws->setCellValue("A{$dr}", "Documento generado electrónicamente el {$fechaEmision}  |  Folio: {$folio}  |  Zona horaria: {$zonaHoraria}  |  SIVACAD");
    $ws->getStyle("A{$dr}")->applyFromArray([
        'font' => ['size' => 7, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial'],
        'alignment' => ['horizontal' => 'center'],
    ]);

    // ─── HOJA 2: MATERIAS ────────────────────────────────────
    $ws2 = $spreadsheet->createSheet();
    $ws2->setTitle('Materias');

    $matColWidths = [6, 18, 14, 42, 14, 12, 16];
    foreach ($matColWidths as $i => $w) {
        $ws2->getColumnDimension(chr(65 + $i))->setWidth($w);
    }

    $ws2->mergeCells('A1:G1');
    $ws2->setCellValue('A1', 'DETALLE ACADÉMICO');
    $ws2->getStyle('A1')->applyFromArray([
        'font' => array_merge($boldFont, ['size' => 14, 'color' => ['argb' => $darkColor]]),
        'alignment' => ['horizontal' => 'center'],
    ]);
    $ws2->getRowDimension(1)->setRowHeight(24);

    $ws2->mergeCells('A2:G2');
    $ws2->setCellValue('A2', "{$nombres}  |  Matrícula: {$alumnoRow['matricula']}  |  Folio: {$folio}");
    $ws2->getStyle('A2')->applyFromArray([
        'font' => ['size' => 9, 'color' => ['argb' => 'FF475569'], 'name' => 'Arial'],
        'alignment' => ['horizontal' => 'center'],
    ]);

    $hHeaders = ['', 'Período', 'Clave', 'Materia', 'Calificación', 'Créditos', 'Estado'];
    $hColLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    $hHeaderRow = 4;
    foreach ($hHeaders as $i => $h) {
        $cell = $hColLetters[$i] . $hHeaderRow;
        $ws2->setCellValue($cell, $h);
        $ws2->getStyle($cell)->applyFromArray([
            'font' => array_merge($boldFont, ['size' => 10, 'color' => ['argb' => 'FFFFFFFF']]),
            'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $primaryColor]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
        ]);
    }
    $ws2->getRowDimension($hHeaderRow)->setRowHeight(22);

    $dr2 = 5;
    if (count($historialDB) === 0) {
        $ws2->mergeCells('A5:G5');
        $ws2->setCellValue('A5', 'No se encontraron materias registradas en el historial académico.');
        $ws2->getStyle('A5')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF94A3B8'], 'name' => 'Arial', 'italic' => true],
            'alignment' => ['horizontal' => 'center'],
        ]);
    } else {
        foreach ($historialDB as $h) {
            $estado = $h['estado'] ?? '—';
            $estadoColor = match (strtolower($estado)) {
                'acreditada'    => 'FF16A34A',
                'no acreditada' => 'FFDC2626',
                'cursando'      => 'FFCA8A04',
                default         => 'FF64748B',
            };
            $bgColor = ($dr2 % 2 === 0) ? 'FFF8FAFC' : 'FFFFFFFF';

            $vals = [
                '',
                $h['nombre_periodo'] ?? '—',
                $h['clave_materia'] ?? '—',
                $h['nombre_materia'] ?? '—',
                $h['calificacion'] !== null ? number_format((float)$h['calificacion'], 1) : '—',
                $h['creditos'] ?? $h['creditos_materia'] ?? 0,
                $estado,
            ];

            foreach ($vals as $ci => $val) {
                $cell = $hColLetters[$ci] . $dr2;
                $ws2->setCellValue($cell, $val);
                $fontColor = ($ci === 6) ? $estadoColor : 'FF334155';
                $isBold = ($ci === 6 && strtolower($estado) === 'acreditada');
                $ws2->getStyle($cell)->applyFromArray([
                    'font' => ['size' => 9, 'color' => ['argb' => $fontColor], 'name' => 'Arial', 'bold' => $isBold],
                    'alignment' => ['vertical' => 'center', 'horizontal' => $ci <= 1 ? 'left' : 'center'],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $bgColor]],
                    'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
                ]);
            }
            $ws2->getRowDimension($dr2)->setRowHeight(20);
            $dr2++;
        }
    }

    // Page setup Sheet 2
    $ws2->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);

    return ['spreadsheet' => $spreadsheet, 'folio' => $folio];
}

// ─── MAIN ────────────────────────────────────────────────
try {
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
            fwrite(STDERR, "Uso: php generar_kardex_excel.php --id=1\n");
            fwrite(STDERR, "     php generar_kardex_excel.php id_alumno=1\n");
            fwrite(STDERR, "Error: {$mensaje}\n");
            exit(1);
        }
        http_response_code(400);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'message' => $mensaje], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $result = generateKardexExcel($idAlumno);
    $spreadsheet = $result['spreadsheet'];
    $folio = $result['folio'];

    // Limpiar el buffer de salida para descartar cualquier warning emitido antes del script
    // (ej. openssl duplicado en XAMPP). Luego escribir el Excel limpio.
    $garbage = ob_get_clean();
    $hasGarbage = $garbage !== false && $garbage !== '';

    if (PHP_SAPI !== 'cli') {
        if (!$hasGarbage) {
            header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        }
        header('Content-Disposition: attachment; filename="kardex_' . rawurlencode($folio) . '.xlsx"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
    }

    // Escribir a archivo temporal para garantizar que no haya mezcla con warnings previos
    $tmpFile = sys_get_temp_dir() . '/kardex_' . bin2hex(random_bytes(4)) . '.xlsx';
    $writer = new Xlsx($spreadsheet);
    $writer->save($tmpFile);
    $cleanContent = file_get_contents($tmpFile);
    unlink($tmpFile);

    if (PHP_SAPI !== 'cli') {
        header('Content-Length: ' . strlen($cleanContent));
    }

    echo $cleanContent;

} catch (PDOException $e) {
    $garbage = @ob_get_clean();
    if (PHP_SAPI !== 'cli') {
        @http_response_code(500);
        @header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'message' => 'Error de base de datos: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    } else {
        fwrite(STDERR, "Error BD: " . $e->getMessage() . "\n");
        exit(1);
    }
} catch (Exception $e) {
    $garbage = @ob_get_clean();
    if (PHP_SAPI !== 'cli') {
        @http_response_code(500);
        @header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'message' => 'Error interno: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    } else {
        fwrite(STDERR, "Error: " . $e->getMessage() . "\n");
        exit(1);
    }
}
