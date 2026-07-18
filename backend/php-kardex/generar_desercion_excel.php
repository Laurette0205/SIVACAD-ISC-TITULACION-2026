<?php
/**
 * generar_desercion_excel.php
 *
 * Endpoint PHP standalone para generar el Excel del Reporte Estratégico de Deserción.
 * Usa PhpSpreadsheet + PDO (MySQL).
 *
 * Uso:
 *   http://localhost/SIVACAD-ISC/backend/php-kardex/generar_desercion_excel.php
 *   http://localhost/SIVACAD-ISC/backend/php-kardex/generar_desercion_excel.php?download=1
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE);
ini_set('display_errors', '0');
ob_start();

require_once __DIR__ . '/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
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

function toNum($value, $fallback = 0): int { return ((int)$value) ?: $fallback; }
function toFloat($value, $fallback = 0.0): float { return ((float)$value) ?: $fallback; }
function getNivel(int $v): string { return $v >= 75 ? 'Crítico' : ($v >= 50 ? 'Alto' : ($v >= 25 ? 'Medio' : 'Bajo')); }

function formatFechaMX(?string $date = null): string
{
    if (!$date) $date = 'now';
    try { $dt = new DateTime($date, new DateTimeZone('America/Mexico_City')); } catch (Exception) { $dt = new DateTime('now', new DateTimeZone('America/Mexico_City')); }
    $dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    $meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return $dias[(int)$dt->format('w')] . ', ' . $dt->format('j') . ' de ' . $meses[(int)$dt->format('n') - 1] . ' de ' . $dt->format('Y') . ', ' . $dt->format('H:i:s') . ' hrs.';
}

function colLetter(int $c): string { return chr(64 + $c); }

// ===== QUERIES (reutilizadas de generar_desercion.php) =====

function obtenerResumenEjecutivo(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("SELECT (SELECT COUNT(*) FROM alumnos) AS alumnos, (SELECT COUNT(*) FROM docentes) AS docentes, (SELECT COUNT(*) FROM grupos) AS grupos, (SELECT COUNT(*) FROM evaluaciones WHERE LOWER(estado)='activa') AS evaluaciones, (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida=0) AS alertas_pendientes, (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida=1) AS alertas_atendidas, (SELECT COUNT(*) FROM ia_alertas_desercion) AS alertas_total, (SELECT nombre_periodo FROM periodos WHERE LOWER(estado)='activo' ORDER BY id_periodo DESC LIMIT 1) AS periodo_activo");
    $row = $stmt->fetch();
    $total = toNum($row['alertas_total'] ?? 0);
    $atendidas = toNum($row['alertas_atendidas'] ?? 0);
    return ['alumnos'=>toNum($row['alumnos']??0),'docentes'=>toNum($row['docentes']??0),'grupos'=>toNum($row['grupos']??0),'evaluaciones'=>toNum($row['evaluaciones']??0),'alertas_total'=>$total,'alertas_pendientes'=>toNum($row['alertas_pendientes']??0),'alertas_atendidas'=>$atendidas,'tasa_atencion'=>$total>0?round(($atendidas/$total)*100):0,'periodo_activo'=>$row['periodo_activo']??'N/D'];
}

function obtenerDistribucionRiesgo(): array { $pdo = dbConnect(); $s = $pdo->query("SELECT nivel_riesgo AS nivel, COUNT(*) AS total FROM ia_alertas_desercion GROUP BY nivel_riesgo ORDER BY FIELD(nivel_riesgo,'Bajo','Medio','Alto','Crítico')"); return $s->fetchAll(); }

function obtenerAnalisisParciales(): array
{
    $pdo = dbConnect();
    $s = $pdo->query("SELECT p.numero_parcial, ROUND(AVG(p.calificacion_promedio),1) AS promedio_general, SUM(p.riesgos_detectados) AS total_riesgos, SUM(p.materias_reprobadas) AS total_reprobadas, COUNT(DISTINCT p.id_alumno) AS alumnos_afectados, SUM(p.alumnos_activos) AS total_activos, SUM(p.alumnos_desertores) AS total_desertores FROM ia_desercion_parciales p GROUP BY p.numero_parcial ORDER BY p.numero_parcial ASC");
    $rows = $s->fetchAll(); $r = [];
    foreach ($rows as $p) { $a=toNum($p['total_activos']??0); $d=toNum($p['total_desertores']??0); $t=$a+$d>0?round(($d/($a+$d))*100):0; $r[]=['numero_parcial'=>(int)$p['numero_parcial'],'promedio_general'=>toFloat($p['promedio_general']??0),'total_riesgos'=>toNum($p['total_riesgos']??0),'total_reprobadas'=>toNum($p['total_reprobadas']??0),'alumnos_afectados'=>toNum($p['alumnos_afectados']??0),'total_activos'=>$a,'total_desertores'=>$d,'total_alumnos'=>$a+$d,'tasa_desercion'=>$t,'nivel_riesgo'=>getNivel($t)]; }
    return $r;
}

function obtenerComparativaCiclos(): array
{
    $pdo = dbConnect();
    $s = $pdo->query("SELECT p.nombre_periodo AS ciclo, COUNT(ia.id_alerta) AS alertas, SUM(CASE WHEN ia.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alto_riesgo, ROUND(AVG(ia.puntaje_riesgo),1) AS riesgo_promedio, (SELECT COUNT(*) FROM alumnos WHERE id_carrera IS NOT NULL) AS total_alumnos FROM periodos p LEFT JOIN ia_alertas_desercion ia ON ia.id_periodo=p.id_periodo GROUP BY p.id_periodo,p.nombre_periodo ORDER BY p.id_periodo ASC LIMIT 10");
    $rows = $s->fetchAll(); $r = [];
    foreach ($rows as $c) { $al=toNum($c['total_alumnos']??0); $alerts=toNum($c['alertas']??0); $r[]=['ciclo'=>$c['ciclo'],'alertas'=>$alerts,'alto_riesgo'=>toNum($c['alto_riesgo']??0),'riesgo_promedio'=>toFloat($c['riesgo_promedio']??0),'total_alumnos'=>$al,'tasa_desercion'=>$al>0?round(($alerts/$al)*100):0]; }
    return $r;
}

function obtenerProgresionTemporal(): array { $pdo = dbConnect(); $s = $pdo->query("SELECT DATE_FORMAT(COALESCE(ia.revisado_en,ia.id_alerta),'%Y-%m') AS mes, SUM(CASE WHEN ia.nivel_riesgo='Bajo' THEN 1 ELSE 0 END) AS bajo, SUM(CASE WHEN ia.nivel_riesgo='Medio' THEN 1 ELSE 0 END) AS medio, SUM(CASE WHEN ia.nivel_riesgo='Alto' THEN 1 ELSE 0 END) AS alto, SUM(CASE WHEN ia.nivel_riesgo='Crítico' THEN 1 ELSE 0 END) AS critico, COUNT(*) AS total FROM ia_alertas_desercion ia GROUP BY DATE_FORMAT(COALESCE(ia.revisado_en,ia.id_alerta),'%Y-%m') ORDER BY mes ASC LIMIT 24"); return $s->fetchAll(); }

function obtenerAnalisisPorCarrera(): array { $pdo = dbConnect(); $s = $pdo->query("SELECT c.nombre_carrera AS carrera, COUNT(ia.id_alerta) AS total_alertas, SUM(CASE WHEN ia.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alto_riesgo, SUM(CASE WHEN ia.atendida=0 THEN 1 ELSE 0 END) AS pendientes FROM carreras c LEFT JOIN alumnos al ON al.id_carrera=c.id_carrera LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno=al.id_alumno GROUP BY c.id_carrera,c.nombre_carrera HAVING total_alertas>0 ORDER BY total_alertas DESC"); return $s->fetchAll(); }

function obtenerMateriasCriticas(): array { $pdo = dbConnect(); $s = $pdo->query("SELECT m.nombre_materia AS materia, COUNT(DISTINCT kh.id_alumno) AS alumnos_evaluados, ROUND(AVG(kh.calificacion),1) AS promedio, SUM(CASE WHEN kh.calificacion<70 THEN 1 ELSE 0 END) AS reprobados FROM materias m INNER JOIN kardex_historial_academico kh ON kh.id_materia=m.id_materia GROUP BY m.id_materia,m.nombre_materia HAVING alumnos_evaluados>0 ORDER BY reprobados DESC, promedio ASC LIMIT 15"); $rows = $s->fetchAll(); $r = []; foreach ($rows as $m) { $p=toFloat($m['promedio']??0); $r[]=['materia'=>$m['materia'],'alumnos_evaluados'=>toNum($m['alumnos_evaluados']??0),'promedio'=>$p,'reprobados'=>toNum($m['reprobados']??0),'nivel'=>$p<70?'Crítico':($p<80?'Atención':'Estable')]; } return $r; }

function obtenerAlertasRecientes(): array { $pdo = dbConnect(); $s = $pdo->query("SELECT ia.id_alerta, a.matricula, u.nombres, u.apellido_paterno, u.apellido_materno, ia.nivel_riesgo, ia.puntaje_riesgo, ia.atendida, ia.estado_seguimiento, c.nombre_carrera, p.nombre_periodo FROM ia_alertas_desercion ia INNER JOIN alumnos a ON ia.id_alumno=a.id_alumno INNER JOIN usuarios u ON a.id_usuario=u.id_usuario LEFT JOIN carreras c ON a.id_carrera=c.id_carrera LEFT JOIN periodos p ON ia.id_periodo=p.id_periodo ORDER BY ia.id_alerta DESC LIMIT 15"); return $s->fetchAll(); }

function generarInsights(array $resumen, array $distribucion, array $parciales, array $ciclos, array $progresion, array $porCarrera, array $porMateria): array
{
    $totalDist = 0; foreach ($distribucion as $d) $totalDist += toNum($d['total']??0);
    $criticos = 0; $alto = 0; foreach ($distribucion as $d) { if (($d['nivel']??'')==='Crítico') $criticos=toNum($d['total']??0); if (($d['nivel']??'')==='Alto') $alto=toNum($d['total']??0); }
    $tasa = $resumen['tasa_atencion']??0;
    $mCrit = array_slice(array_filter($porMateria, fn($m)=>($m['reprobados']??0)>0), 0, 3);
    $tend = count($parciales)>=2 ? (end($parciales)['promedio_general']??0) < (reset($parciales)['promedio_general']??0) ? 'declive' : 'mejora' : 'estable';
    $l = [];
    $l[] = 'RESUMEN INSTITUCIONAL: El sistema SIVACAD registra un total de '.$resumen['alumnos'].' alumnos activos distribuidos en '.$resumen['grupos'].' grupos academicos, con la participacion de '.$resumen['docentes'].' docentes. Durante el periodo '.$resumen['periodo_activo'].' se han generado '.$resumen['alertas_total'].' alertas de desercion, de las cuales '.$resumen['alertas_pendientes'].' se encuentran pendientes de atencion y '.$resumen['alertas_atendidas'].' han sido atendidas, lo que representa una tasa de atencion del '.$tasa.'%.';
    if ($criticos > 0) $l[] = 'RIESGO CRITICO: Se identificaron '.$criticos.' casos clasificados como riesgo critico, los cuales requieren intervencion institucional inmediata.';
    if ($alto > 0) $l[] = 'RIESGO ALTO: Un total de '.$alto.' alumnos se encuentran en nivel de riesgo alto (puntaje entre 50 y 74 puntos).';
    $l[] = 'ATENCION INSTITUCIONAL: La tasa de atencion institucional es del '.$tasa.'%. '.($tasa>=50 ? 'Nivel adecuado de seguimiento.' : 'Mas de la mitad de las alertas no han sido atendidas aun.');
    if (count($mCrit) > 0) { $p=[]; foreach ($mCrit as $m) $p[]=$m['materia'].' (promedio '.$m['promedio'].', '.$m['reprobados'].' reprobados)'; $l[]='MATERIAS CRITICAS: '.implode('; ',$p).'.'; }
    if (count($porCarrera)>0) $l[] = 'ANALISIS POR CARRERA: La carrera de '.$porCarrera[0]['carrera'].' concentra la mayor cantidad de alertas ('.$porCarrera[0]['total_alertas'].').';
    if (count($parciales)>=2) { $p=$parciales[0]; $u=$parciales[count($parciales)-1]; $l[]='TENDENCIA POR PARCIALES: En Parcial '.$p['numero_parcial'].' promedio '.$p['promedio_general'].', desercion '.$p['tasa_desercion'].'%. Parcial '.$u['numero_parcial'].' promedio '.$u['promedio_general'].', desercion '.$u['tasa_desercion'].'%. Tendencia: '.$tend.'.'; }
    if (count($progresion)>2) { $f=$progresion[0]; $l2=$progresion[count($progresion)-1]; $tr=toNum($l2['total']??0)>toNum($f['total']??0)?'incremento':'disminucion'; $l[]='PROGRESION TEMPORAL: '.$tr.' de '.($f['total']??0).' ('.($f['mes']??'').') a '.($l2['total']??0).' ('.($l2['mes']??'').').'; }
    if (count($ciclos)>=2) { $p=$ciclos[0]; $u=$ciclos[count($ciclos)-1]; $l[]='COMPARATIVA ENTRE CICLOS: '.$p['ciclo'].' '.$p['alertas'].' alertas ('.$p['tasa_desercion'].'%), '.$u['ciclo'].' '.$u['alertas'].' alertas ('.$u['tasa_desercion'].'%).'; }
    return $l;
}

// ===== MAIN =====

try {
    ob_clean();

    $resumen    = obtenerResumenEjecutivo();
    $dist       = obtenerDistribucionRiesgo();
    $parciales  = obtenerAnalisisParciales();
    $ciclos     = obtenerComparativaCiclos();
    $progresion = obtenerProgresionTemporal();
    $porCarrera = obtenerAnalisisPorCarrera();
    $porMateria = obtenerMateriasCriticas();
    $alertas    = obtenerAlertasRecientes();
    $insights   = generarInsights($resumen, $dist, $parciales, $ciclos, $progresion, $porCarrera, $porMateria);

    $periodo = $resumen['periodo_activo'] ?? 'N/D';
    $fecha = formatFechaMX();

    $spreadsheet = new Spreadsheet();
    $spreadsheet->getProperties()
        ->setCreator('SIVACAD')
        ->setTitle('Reporte de Desercion')
        ->setSubject('Reporte Estrategico de Desercion')
        ->setDescription('Reporte generado por SIVACAD')
        ->setCreated(time());

    $styles = [
        'title' => ['font' => ['bold'=>true,'size'=>14,'color'=>['argb'=>'FF0F172A'],'name'=>'Arial']],
        'subtitle' => ['font' => ['bold'=>true,'size'=>11,'color'=>['argb'=>'FF1E293B'],'name'=>'Arial']],
        'header' => ['font' => ['bold'=>true,'size'=>9,'color'=>['argb'=>'FFFFFFFF'],'name'=>'Arial'],'fill'=>['type'=>'solid','color'=>['argb'=>'FF4F46E5']]],
        'cell' => ['font' => ['size'=>9,'color'=>['argb'=>'FF334155'],'name'=>'Arial']],
        'number' => ['font' => ['size'=>9,'bold'=>true,'color'=>['argb'=>'FF0F172A'],'name'=>'Arial'],'alignment'=>['horizontal'=>'center']],
        'meta' => ['font' => ['size'=>8,'italic'=>true,'color'=>['argb'=>'FF94A3B8'],'name'=>'Arial']],
    ];
    $borderStyle = ['style'=>'thin','color'=>['argb'=>'FFE2E8F0']];

    // ===== HOJA 1: RESUMEN EJECUTIVO =====
    $ws1 = $spreadsheet->getActiveSheet();
    $ws1->setTitle('Resumen Ejecutivo');
    foreach (['A'=>32,'B'=>32,'C'=>32,'D'=>32,'E'=>32,'F'=>32] as $c=>$w) $ws1->getColumnDimension($c)->setWidth($w);
    $ws1->setShowGridlines(false);

    $ws1->mergeCells('A1:F1');
    $ws1->setCellValue('A1','SIVACAD - Reporte Estrategico de Riesgo de Desercion');
    $ws1->getStyle('A1')->applyFromArray($styles['title']);
    $ws1->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $ws1->getRowDimension(1)->setRowHeight(28);

    $ws1->mergeCells('A2:F2');
    $ws1->setCellValue('A2','Periodo: '.$periodo.' | Generado: '.$fecha);
    $ws1->getStyle('A2')->applyFromArray($styles['meta']);
    $ws1->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    $r = $resumen;
    $ws1->setCellValue('A4','INDICADORES GENERALES');
    $ws1->getStyle('A4')->applyFromArray($styles['subtitle']);

    $labels = [['A5','Alertas Totales',toNum($r['alertas_total']??0),'#4f46e5'],['B5','Pendientes',toNum($r['alertas_pendientes']??0),'#f97316'],['C5','Atendidas',toNum($r['alertas_atendidas']??0),'#16a34a'],['D5','Tasa Atencion',toNum($r['tasa_atencion']??0).'%','#16a34a'],['E5','Alumnos',toNum($r['alumnos']??0),'#3b82f6'],['F5','Grupos',toNum($r['grupos']??0),'#8b5cf6']];
    foreach ($labels as $l) {
        $ws1->setCellValue($l[0].'5',$l[1]);
        $ws1->getStyle($l[0].'5')->applyFromArray(['font'=>['bold'=>true,'size'=>8,'color'=>['argb'=>'FF64748B'],'name'=>'Arial'],'alignment'=>['horizontal'=>'center']]);
        $ws1->setCellValue($l[0].'6',$l[2]);
        $ws1->getStyle($l[0].'6')->applyFromArray(['font'=>['bold'=>true,'size'=>16,'color'=>['argb'=>$l[3]],'name'=>'Arial'],'alignment'=>['horizontal'=>'center']]);
    }
    $ws1->getRowDimension(6)->setRowHeight(32);

    $row = 8;
    $ws1->setCellValue('A'.$row,'DISTRIBUCION DE RIESGO');
    $ws1->getStyle('A'.$row)->applyFromArray($styles['subtitle']);
    $row++;

    $distHeaders = ['A'=>'Nivel','B'=>'Total','C'=>'Porcentaje'];
    $col = 1; foreach ($distHeaders as $c=>$h) { $ws1->setCellValue(colLetter($col).$row,$h); $ws1->getStyle(colLetter($col).$row)->applyFromArray($styles['header']); $col++; }
    $totalDist = 0; foreach ($dist as $d) $totalDist += toNum($d['total']??0);
    $row++;
    foreach ($dist as $d) {
        $nivel = $d['nivel']??''; $total = toNum($d['total']??0); $pct = $totalDist>0 ? round(($total/$totalDist)*100,1) : 0;
        $ws1->setCellValue('A'.$row,$nivel); $ws1->setCellValue('B'.$row,$total); $ws1->setCellValue('C'.$row,$pct.'%');
        foreach (['A','B','C'] as $c) $ws1->getStyle($c.$row)->applyFromArray($styles['cell']);
        $ws1->getStyle('A'.$row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        $row++;
    }

    $row += 2;
    $ws1->setCellValue('A'.$row,'INSIGHTS ESTRATEGICOS');
    $ws1->getStyle('A'.$row)->applyFromArray($styles['subtitle']);
    $row++;

    foreach ($insights as $ins) {
        $ws1->mergeCells('A'.$row.':F'.$row);
        $ws1->setCellValue('A'.$row,$ins);
        $ws1->getStyle('A'.$row)->applyFromArray($styles['cell']);
        $ws1->getStyle('A'.$row)->getAlignment()->setWrapText(true);
        $ws1->getRowDimension($row)->setRowHeight(28);
        $row++;
    }

    // ===== HOJA 2: DATOS TABULADOS =====
    $ws2 = $spreadsheet->addSheet('Datos Tabulados');
    foreach (['A'=>18,'B'=>18,'C'=>18,'D'=>18,'E'=>18,'F'=>18,'G'=>18,'H'=>18] as $c=>$w) $ws2->getColumnDimension($c)->setWidth($w);

    $ws2->mergeCells('A1:H1');
    $ws2->setCellValue('A1','SIVACAD - Datos Tabulados de Desercion');
    $ws2->getStyle('A1')->applyFromArray($styles['title']);
    $ws2->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    $row = 3;
    if (count($parciales) > 0) {
        $ws2->setCellValue('A'.$row,'ANALISIS POR PARCIALES');
        $ws2->getStyle('A'.$row)->applyFromArray($styles['subtitle']);
        $row++;
        $phs = ['A'=>'Parcial','B'=>'Promedio','C'=>'Riesgos','D'=>'Reprob.','E'=>'Activos','F'=>'Desert.','G'=>'Tasa'];
        $col=1; foreach ($phs as $c=>$h) { $ws2->setCellValue(colLetter($col).$row,$h); $ws2->getStyle(colLetter($col).$row)->applyFromArray($styles['header']); $col++; }
        $row++;
        foreach ($parciales as $p) {
            $ws2->setCellValue('A'.$row,'Parcial '.($p['numero_parcial']??'')); $ws2->setCellValue('B'.$row,toFloat($p['promedio_general']??0)); $ws2->setCellValue('C'.$row,toNum($p['total_riesgos']??0)); $ws2->setCellValue('D'.$row,toNum($p['total_reprobadas']??0)); $ws2->setCellValue('E'.$row,toNum($p['total_activos']??0)); $ws2->setCellValue('F'.$row,toNum($p['total_desertores']??0)); $ws2->setCellValue('G'.$row,toNum($p['tasa_desercion']??0).'%');
            foreach (['A','B','C','D','E','F','G'] as $c) $ws2->getStyle($c.$row)->applyFromArray($styles['cell']);
            $row++;
        }
        $row++;
    }

    if (count($ciclos) > 0) {
        $ws2->setCellValue('A'.$row,'COMPARATIVA POR CICLOS');
        $ws2->getStyle('A'.$row)->applyFromArray($styles['subtitle']);
        $row++;
        $chs = ['A'=>'Ciclo','B'=>'Alertas','C'=>'Alto/Critico','D'=>'Riesgo Prom.','E'=>'Alumnos','F'=>'Tasa'];
        $col=1; foreach ($chs as $c=>$h) { $ws2->setCellValue(colLetter($col).$row,$h); $ws2->getStyle(colLetter($col).$row)->applyFromArray($styles['header']); $col++; }
        $row++;
        foreach ($ciclos as $c) {
            $ws2->setCellValue('A'.$row,$c['ciclo']??''); $ws2->setCellValue('B'.$row,toNum($c['alertas']??0)); $ws2->setCellValue('C'.$row,toNum($c['alto_riesgo']??0)); $ws2->setCellValue('D'.$row,toFloat($c['riesgo_promedio']??0)); $ws2->setCellValue('E'.$row,toNum($c['total_alumnos']??0)); $ws2->setCellValue('F'.$row,toNum($c['tasa_desercion']??0).'%');
            foreach (['A','B','C','D','E','F'] as $c2) $ws2->getStyle($c2.$row)->applyFromArray($styles['cell']);
            $row++;
        }
        $row++;
    }

    if (count($progresion) > 0) {
        $ws2->setCellValue('A'.$row,'PROGRESION TEMPORAL');
        $ws2->getStyle('A'.$row)->applyFromArray($styles['subtitle']);
        $row++;
        $phs2 = ['A'=>'Mes','B'=>'Bajo','C'=>'Medio','D'=>'Alto','E'=>'Critico','F'=>'Total'];
        $col=1; foreach ($phs2 as $c=>$h) { $ws2->setCellValue(colLetter($col).$row,$h); $ws2->getStyle(colLetter($col).$row)->applyFromArray($styles['header']); $col++; }
        $row++;
        foreach ($progresion as $p) {
            $ws2->setCellValue('A'.$row,$p['mes']??''); $ws2->setCellValue('B'.$row,toNum($p['bajo']??0)); $ws2->setCellValue('C'.$row,toNum($p['medio']??0)); $ws2->setCellValue('D'.$row,toNum($p['alto']??0)); $ws2->setCellValue('E'.$row,toNum($p['critico']??0)); $ws2->setCellValue('F'.$row,toNum($p['total']??0));
            foreach (['A','B','C','D','E','F'] as $c2) $ws2->getStyle($c2.$row)->applyFromArray($styles['cell']);
            $row++;
        }
    }

    // ===== HOJA 3: ALERTAS =====
    $ws3 = $spreadsheet->addSheet('Alertas y Carreras');
    foreach (['A'=>8,'B'=>16,'C'=>35,'D'=>14,'E'=>10,'F'=>14,'G'=>14] as $c=>$w) $ws3->getColumnDimension($c)->setWidth($w);

    $ws3->mergeCells('A1:G1');
    $ws3->setCellValue('A1','SIVACAD - Alertas Recientes de Desercion');
    $ws3->getStyle('A1')->applyFromArray($styles['title']);
    $ws3->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

    $row = 3;
    if (count($alertas) > 0) {
        $ws3->setCellValue('A'.$row,'ALERTAS RECIENTES');
        $ws3->getStyle('A'.$row)->applyFromArray($styles['subtitle']);
        $row++;
        $ahs = ['A'=>'#','B'=>'Matricula','C'=>'Alumno','D'=>'Riesgo','E'=>'Puntaje','F'=>'Estado','G'=>'Periodo'];
        $col=1; foreach ($ahs as $c=>$h) { $ws3->setCellValue(colLetter($col).$row,$h); $ws3->getStyle(colLetter($col).$row)->applyFromArray($styles['header']); $col++; }
        $row++;
        foreach ($alertas as $a) {
            $nom = trim(($a['nombres']??'').' '.($a['apellido_paterno']??'').' '.($a['apellido_materno']??''));
            $estado = !empty($a['atendida']) ? 'Atendida' : 'Pendiente';
            $ws3->setCellValue('A'.$row,$row-3); $ws3->setCellValue('B'.$row,$a['matricula']??''); $ws3->setCellValue('C'.$row,$nom); $ws3->setCellValue('D'.$row,$a['nivel_riesgo']??''); $ws3->setCellValue('E'.$row,toNum($a['puntaje_riesgo']??0)); $ws3->setCellValue('F'.$row,$estado); $ws3->setCellValue('G'.$row,$a['nombre_periodo']??'');
            foreach (['A','B','C','D','E','F','G'] as $c2) $ws3->getStyle($c2.$row)->applyFromArray($styles['cell']);
            $row++;
        }
        $row++;
    }

    if (count($porCarrera) > 0) {
        $ws3->setCellValue('A'.$row,'ANALISIS POR CARRERA');
        $ws3->getStyle('A'.$row)->applyFromArray($styles['subtitle']);
        $row++;
        $chs3 = ['A'=>'Carrera','B'=>'Alertas','C'=>'Alto/Critico','D'=>'Pendientes'];
        $col=1; foreach ($chs3 as $c=>$h) { $ws3->setCellValue(colLetter($col).$row,$h); $ws3->getStyle(colLetter($col).$row)->applyFromArray($styles['header']); $col++; }
        $row++;
        foreach ($porCarrera as $c) {
            $ws3->setCellValue('A'.$row,$c['carrera']??''); $ws3->setCellValue('B'.$row,toNum($c['total_alertas']??0)); $ws3->setCellValue('C'.$row,toNum($c['alto_riesgo']??0)); $ws3->setCellValue('D'.$row,toNum($c['pendientes']??0));
            foreach (['A','B','C','D'] as $c2) $ws3->getStyle($c2.$row)->applyFromArray($styles['cell']);
            $row++;
        }
    }

    // Autoajuste de columnas
    foreach ([$ws1, $ws2, $ws3] as $ws) {
        foreach (range('A','Z') as $col) {
            try { $ws->getColumnDimension($col)->setAutoSize(true); } catch (Exception $e) { break; }
        }
    }

    $writer = new Xlsx($spreadsheet);
    ob_clean();

    if (PHP_SAPI === 'cli') {
        $writer->save('php://stdout');
    } else {
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="reporte_desercion_sivacad.xlsx"');
        header('Cache-Control: max-age=0');
        $writer->save('php://output');
    }
    exit;

} catch (Exception $e) {
    ob_clean();
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
        exit(1);
    } else {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => $e->getMessage()]);
        exit;
    }
}
