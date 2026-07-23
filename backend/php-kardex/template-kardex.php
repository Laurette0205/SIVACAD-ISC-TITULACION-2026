<?php
/**
 * SIVACAD-ISC — Copyright (c) 2026 Bárcenas González Laura Casandra &
 *                    Morales Ibarra Sandivel — TESI — ISC
 */
function getKardexTemplate(array $data): string
{
    $folio = htmlspecialchars($data['folio'] ?? '—', ENT_QUOTES, 'UTF-8');
    $fechaEmision = htmlspecialchars($data['fecha_emision'] ?? '—', ENT_QUOTES, 'UTF-8');
    $zonaHoraria = htmlspecialchars($data['zona_horaria'] ?? '—', ENT_QUOTES, 'UTF-8');
    $nombre = htmlspecialchars($data['alumno']['nombre_completo'] ?? '—', ENT_QUOTES, 'UTF-8');
    $matricula = htmlspecialchars($data['alumno']['matricula'] ?? '—', ENT_QUOTES, 'UTF-8');
    $curp = htmlspecialchars($data['alumno']['curp'] ?? '—', ENT_QUOTES, 'UTF-8');
    $carrera = htmlspecialchars($data['alumno']['carrera'] ?? '—', ENT_QUOTES, 'UTF-8');
    $semestre = htmlspecialchars((string)($data['alumno']['semestre'] ?? '—'), ENT_QUOTES, 'UTF-8');
    $promedio = number_format((float)($data['alumno']['promedio'] ?? 0), 2);
    $creditos = (string)($data['alumno']['creditos_cubiertos'] ?? '—');
    $estatus = htmlspecialchars($data['alumno']['estatus'] ?? '—', ENT_QUOTES, 'UTF-8');
    $firmaHash = htmlspecialchars($data['firma_electronica'] ?? '—', ENT_QUOTES, 'UTF-8');
    $nota = htmlspecialchars($data['nota_institucional'] ?? '', ENT_QUOTES, 'UTF-8');

    $fotoBase64 = '';
    if (!empty($data['alumno']['fotografia_url'])) {
        $fotoUrl = $data['alumno']['fotografia_url'];
        if (file_exists($fotoUrl)) {
            $fotoBase64 = base64_encode_file($fotoUrl);
        } elseif (filter_var($fotoUrl, FILTER_VALIDATE_URL)) {
            $ctx = stream_context_create(['http' => ['timeout' => 5]]);
            $content = @file_get_contents($fotoUrl, false, $ctx);
            if ($content !== false) {
                $fotoBase64 = base64_encode($content);
            }
        }
    }

    $qrBase64 = '';
    if (!empty($data['alumno']['url_qr'])) {
        $qrUrl = $data['alumno']['url_qr'];
        if (file_exists($qrUrl)) {
            $qrBase64 = base64_encode_file($qrUrl);
        } elseif (filter_var($qrUrl, FILTER_VALIDATE_URL)) {
            $ctx = stream_context_create(['http' => ['timeout' => 5]]);
            $content = @file_get_contents($qrUrl, false, $ctx);
            if ($content !== false) {
                $qrBase64 = base64_encode($content);
            }
        }
    }

    $sellos = $data['sellos'] ?? [];
    if (count($sellos) === 0) {
        $sellos = [
            ['titulo' => 'Sello SIVACAD', 'descripcion' => 'Sello oficial del Sistema Integral de Validación y Control Académico'],
            ['titulo' => 'Sello División ISC', 'descripcion' => 'Sello de la División de Ingeniería en Sistemas Computacionales'],
            ['titulo' => 'Sello Control Escolar', 'descripcion' => 'Sello oficial de Control Escolar'],
        ];
    }

    $sello1 = ''; $sello2 = ''; $sello3 = '';
    $selloIdx = 0;
    foreach (array_slice($sellos, 0, 3) as $s) {
        $tit = htmlspecialchars($s['titulo'] ?? '', ENT_QUOTES, 'UTF-8');
        $des = htmlspecialchars($s['descripcion'] ?? '', ENT_QUOTES, 'UTF-8');
        $sb = <<<SELLO
        <div style="border-top:1px solid #000000;padding-top:5px;margin:0 10px;">
            <div style="font-size:7pt;font-weight:700;color:#0f172a;">{$tit}</div>
            <div style="font-size:5.5pt;color:#64748b;margin-top:2px;">{$des}</div>
        </div>
SELLO;
        if ($selloIdx === 0) $sello1 = $sb;
        elseif ($selloIdx === 1) $sello2 = $sb;
        else $sello3 = $sb;
        $selloIdx++;
    }

    $logoPath = __DIR__ . '/../../frontend/src/assets';
    $logo_tecnm  = base64_encode_file($logoPath . '/Logo-TecNM.png');
    $logo_sivacad = base64_encode_file($logoPath . '/Logo-SIVACAD.jpeg');
    $logo_tesi   = base64_encode_file($logoPath . '/Logo-TESI.png');
    $watermark   = base64_encode_file($logoPath . '/marcadeagua_SIVACAD.jpeg');
    $sello_sivacad = base64_encode_file($logoPath . '/Sello-SIVACAD.jpeg');

    $fotoHtml = $fotoBase64
        ? '<img src="data:image/jpeg;base64,' . $fotoBase64 . '" style="width:100%;height:100%;object-fit:cover;" alt="Foto">'
        : '<span style="color:#94a3b8;font-size:5pt;">Foto institucional</span>';

    $qrHtml = $qrBase64
        ? '<img src="data:image/png;base64,' . $qrBase64 . '" style="width:55px;height:55px;" alt="QR">'
        : '<span style="color:#94a3b8;font-size:4.5pt;">QR del sistema SIVACAD</span>';

    $selloSivacadImg = $sello_sivacad
        ? '<img src="data:image/jpeg;base64,' . $sello_sivacad . '" style="height:32px;opacity:0.85;" alt="Sello SIVACAD"/>'
        : '';

    $copyHeader = '<div style="font-size:7pt;color:#64748b;text-align:center;font-weight:600;margin-bottom:4px;">SIVACAD-ISC &mdash; Propiedad intelectual de B&aacute;rcenas Gonz&aacute;lez Laura Casandra &amp; Morales Ibarra Sandivel &mdash; TESI &mdash; Ingenier&iacute;a en Sistemas Computacionales</div>';

    $wmStyle = $watermark
        ? "background-image: url('data:image/jpeg;base64,{$watermark}');"
        : '';

    $historial = $data['historial'] ?? [];
    $histBodyRows = '';
    $rowIdx = 0;
    foreach ($historial as $h) {
        $periodo = htmlspecialchars($h['periodo'] ?? '—', ENT_QUOTES, 'UTF-8');
        $clave   = htmlspecialchars($h['clave'] ?? '—', ENT_QUOTES, 'UTF-8');
        $materia = htmlspecialchars($h['materia'] ?? '—', ENT_QUOTES, 'UTF-8');
        $calif   = htmlspecialchars((string)($h['calificacion'] ?? '—'), ENT_QUOTES, 'UTF-8');
        $cred    = htmlspecialchars((string)($h['creditos'] ?? '—'), ENT_QUOTES, 'UTF-8');
        $estado  = htmlspecialchars($h['estado'] ?? '—', ENT_QUOTES, 'UTF-8');
        $eColor = match (strtolower($estado)) {
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
            <td style="padding:3px 2px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;color:{$eColor};font-weight:700;">{$estado}</td>
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
    @page { margin: 2.54cm 2.54cm 3.0cm 3.0cm; size: letter; }
    * { margin: 0; padding: 0; }
    body {
        font-family: 'Helvetica', 'Arial', sans-serif;
        font-size: 12pt;
        color: #0f172a;
        line-height: 1.5;
        text-align: justify;
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

<!-- LOGOS -->
<table style="width:100%;border-collapse:collapse;border:none;">
    <tr>
        <td style="width:33%;text-align:left;vertical-align:middle;border:none;padding:0;">
            <img src="data:image/png;base64,{$logo_tecnm}" style="height:48px;" alt="TecNM">
        </td>
        <td style="width:34%;text-align:center;vertical-align:middle;border:none;padding:0;">
            <img src="data:image/jpeg;base64,{$logo_sivacad}" style="height:48px;" alt="SIVACAD">
        </td>
        <td style="width:33%;text-align:right;vertical-align:middle;border:none;padding:0;">
            <img src="data:image/png;base64,{$logo_tesi}" style="height:48px;" alt="TESI">
        </td>
    </tr>
</table>

{$copyHeader}

<!-- TITULO -->
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
            Folio: <strong>{$folio}</strong> &nbsp;|&nbsp; Emitido: <strong>{$fechaEmision}</strong> &nbsp;|&nbsp; Zona horaria: <strong>{$zonaHoraria}</strong>
        </td>
    </tr>
</table>

<!-- DATOS DEL ALUMNO + FOTO -->
<table style="width:100%;border-collapse:collapse;border:none;margin-top:3px;">
    <tr>
        <td style="font-size:8.5pt;font-weight:700;color:#1e40af;border-bottom:1.5px solid #1e40af;padding-bottom:2px;text-transform:uppercase;">DATOS DEL ALUMNO</td>
    </tr>
</table>

<table style="width:100%;border-collapse:collapse;border:none;margin-top:3px;">
    <tr>
        <td style="width:65%;vertical-align:top;border:none;padding-right:10px;">
            <table style="width:100%;border-collapse:collapse;border:none;font-size:7.5pt;">
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Nombre Completo:</td><td style="color:#334155;padding:1px 0;">{$nombre}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Matr&iacute;cula:</td><td style="color:#334155;padding:1px 0;">{$matricula}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">CURP:</td><td style="color:#334155;padding:1px 0;">{$curp}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Carrera:</td><td style="color:#334155;padding:1px 0;">{$carrera}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Semestre:</td><td style="color:#334155;padding:1px 0;">{$semestre}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Promedio General:</td><td style="color:#334155;padding:1px 0;">{$promedio}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Cr&eacute;ditos cubiertos:</td><td style="color:#334155;padding:1px 0;">{$creditos}</td></tr>
                <tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Estatus:</td><td style="font-weight:700;color:#16a34a;padding:1px 0;">{$estatus}</td></tr>
            </table>
        </td>
        <td style="width:35%;vertical-align:top;text-align:right;border:none;">
            <table style="border-collapse:collapse;margin-left:auto;">
                <tr>
                    <td style="width:3cm;height:2.5cm;border:1.5px solid #cbd5e1;text-align:center;vertical-align:middle;background:#f8fafc;">
                        {$fotoHtml}
                    </td>
                </tr>
            </table>
            <table style="border-collapse:collapse;margin-left:auto;margin-top:3px;">
                <tr>
                    <td style="text-align:center;">{$qrHtml}</td>
                </tr>
            </table>
            <table style="width:3cm;border-collapse:collapse;border:none;margin-left:auto;margin-top:2px;">
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

<!-- HISTORIAL -->
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
            {$nota}
            Si quieres visualizar o verificar qu&eacute; materias acreditaste, est&aacute;s en 2da oportunidad, si est&aacute;s en
            recurse o te fuiste a materia especial, visita la plataforma oficial SIGAA (Sistema Integral de
            Gesti&oacute;n Acad&eacute;mica y Administrativa) para m&aacute;s informaci&oacute;n. El link de la plataforma oficial es el
            siguiente: <strong>https://sigaa.tesi.org.mx/index.php</strong>
        </td>
    </tr>
</table>

<div class="fixed-bottom">

<!-- SELLOS -->
<table style="width:100%;border-collapse:collapse;border:none;">
    <tr>
        <td style="width:25%;vertical-align:middle;text-align:left;border:none;padding:4px;">
            {$selloSivacadImg}
        </td>
        <td style="width:25%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">
            {$sello1}
        </td>
        <td style="width:25%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">
            {$sello2}
        </td>
        <td style="width:25%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">
            {$sello3}
        </td>
    </tr>
</table>

<!-- PIE -->
<table style="width:100%;border-collapse:collapse;border:none;">
    <tr>
        <td style="text-align:center;font-size:6pt;color:#94a3b8;border-top:1px solid #cbd5e1;padding:3px 0;">
            Documento generado por SIVACAD-ISC &copy; 2026 B&aacute;rcenas Gonz&aacute;lez Laura Casandra &amp; Morales Ibarra Sandivel &mdash; TESI &mdash; ISC &mdash; Proyecto de Titulaci&oacute;n &mdash; Folio: {$folio} &mdash; Emitido: {$fechaEmision}
        </td>
    </tr>
</table>

</div>

</body>
</html>
HTML;
}

function base64_encode_file(string $path): string
{
    if (!file_exists($path) || !is_readable($path)) return '';
    $data = file_get_contents($path);
    if ($data === false) return '';
    return base64_encode($data);
}
