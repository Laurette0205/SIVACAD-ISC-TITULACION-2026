<?php
/**
 * generar_desercion.php
 *
 * Endpoint PHP standalone para generar el PDF del Reporte Estratégico de Deserción.
 * Usa Dompdf + PDO (MySQL).
 *
 * Uso:
 *   http://localhost/SIVACAD-ISC/backend/php-kardex/generar_desercion.php
 *   http://localhost/SIVACAD-ISC/backend/php-kardex/generar_desercion.php?download=1
 *   php generar_desercion.php > reporte_desercion.pdf
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE);
ini_set('display_errors', '0');
ob_start();

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/template-desercion.php';

use Dompdf\Dompdf;
use Dompdf\Options;

$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = '';
$DB_NAME = 'sivacad_isc';
$DB_PORT = 3306;

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

function toNum($value, $fallback = 0): int
{
    $n = (int)$value;
    return $n ?: $fallback;
}

function toFloat($value, $fallback = 0.0): float
{
    $n = (float)$value;
    return $n ?: $fallback;
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

function getNivel(int $value): string
{
    if ($value >= 75) return 'Crítico';
    if ($value >= 50) return 'Alto';
    if ($value >= 25) return 'Medio';
    return 'Bajo';
}

// ===== QUERIES =====

function obtenerResumenEjecutivo(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("
        SELECT
            (SELECT COUNT(*) FROM alumnos) AS alumnos,
            (SELECT COUNT(*) FROM docentes) AS docentes,
            (SELECT COUNT(*) FROM grupos) AS grupos,
            (SELECT COUNT(*) FROM evaluaciones WHERE LOWER(estado) = 'activa') AS evaluaciones,
            (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 0) AS alertas_pendientes,
            (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 1) AS alertas_atendidas,
            (SELECT COUNT(*) FROM ia_alertas_desercion) AS alertas_total,
            (SELECT nombre_periodo FROM periodos WHERE LOWER(estado) = 'activo' ORDER BY id_periodo DESC LIMIT 1) AS periodo_activo
    ");
    $row = $stmt->fetch();
    $total = toNum($row['alertas_total'] ?? 0);
    $atendidas = toNum($row['alertas_atendidas'] ?? 0);
    return [
        'alumnos'          => toNum($row['alumnos'] ?? 0),
        'docentes'         => toNum($row['docentes'] ?? 0),
        'grupos'           => toNum($row['grupos'] ?? 0),
        'evaluaciones'     => toNum($row['evaluaciones'] ?? 0),
        'alertas_total'    => $total,
        'alertas_pendientes' => toNum($row['alertas_pendientes'] ?? 0),
        'alertas_atendidas'  => $atendidas,
        'tasa_atencion'    => $total > 0 ? round(($atendidas / $total) * 100) : 0,
        'periodo_activo'   => $row['periodo_activo'] ?? 'N/D',
    ];
}

function obtenerDistribucionRiesgo(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("
        SELECT nivel_riesgo AS nivel, COUNT(*) AS total
        FROM ia_alertas_desercion
        GROUP BY nivel_riesgo
        ORDER BY FIELD(nivel_riesgo,'Bajo','Medio','Alto','Crítico')
    ");
    return $stmt->fetchAll();
}

function obtenerAnalisisParciales(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("
        SELECT
            p.numero_parcial,
            ROUND(AVG(p.calificacion_promedio), 1) AS promedio_general,
            SUM(p.riesgos_detectados) AS total_riesgos,
            SUM(p.materias_reprobadas) AS total_reprobadas,
            COUNT(DISTINCT p.id_alumno) AS alumnos_afectados,
            SUM(p.alumnos_activos) AS total_activos,
            SUM(p.alumnos_desertores) AS total_desertores
        FROM ia_desercion_parciales p
        GROUP BY p.numero_parcial
        ORDER BY p.numero_parcial ASC
    ");
    $rows = $stmt->fetchAll();
    $result = [];
    foreach ($rows as $p) {
        $activos = toNum($p['total_activos'] ?? 0);
        $desertores = toNum($p['total_desertores'] ?? 0);
        $totalAlumnos = $activos + $desertores;
        $tasa = $totalAlumnos > 0 ? round(($desertores / $totalAlumnos) * 100) : 0;
        $result[] = [
            'numero_parcial'     => (int)$p['numero_parcial'],
            'promedio_general'   => toFloat($p['promedio_general'] ?? 0),
            'total_riesgos'      => toNum($p['total_riesgos'] ?? 0),
            'total_reprobadas'   => toNum($p['total_reprobadas'] ?? 0),
            'alumnos_afectados'  => toNum($p['alumnos_afectados'] ?? 0),
            'total_activos'      => $activos,
            'total_desertores'   => $desertores,
            'total_alumnos'      => $totalAlumnos,
            'tasa_desercion'     => $tasa,
            'nivel_riesgo'       => getNivel($tasa),
        ];
    }
    return $result;
}

function obtenerComparativaCiclos(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("
        SELECT
            p.nombre_periodo AS ciclo,
            COUNT(ia.id_alerta) AS alertas,
            SUM(CASE WHEN ia.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alto_riesgo,
            ROUND(AVG(ia.puntaje_riesgo), 1) AS riesgo_promedio,
            (SELECT COUNT(*) FROM alumnos WHERE id_carrera IS NOT NULL) AS total_alumnos
        FROM periodos p
        LEFT JOIN ia_alertas_desercion ia ON ia.id_periodo = p.id_periodo
        GROUP BY p.id_periodo, p.nombre_periodo
        ORDER BY p.id_periodo ASC
        LIMIT 10
    ");
    $rows = $stmt->fetchAll();
    $result = [];
    foreach ($rows as $c) {
        $alumnos = toNum($c['total_alumnos'] ?? 0);
        $alertas = toNum($c['alertas'] ?? 0);
        $result[] = [
            'ciclo'          => $c['ciclo'],
            'alertas'        => $alertas,
            'alto_riesgo'    => toNum($c['alto_riesgo'] ?? 0),
            'riesgo_promedio' => toFloat($c['riesgo_promedio'] ?? 0),
            'total_alumnos'  => $alumnos,
            'tasa_desercion' => $alumnos > 0 ? round(($alertas / $alumnos) * 100) : 0,
        ];
    }
    return $result;
}

function obtenerProgresionTemporal(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("
        SELECT
            DATE_FORMAT(COALESCE(ia.revisado_en, ia.id_alerta), '%Y-%m') AS mes,
            SUM(CASE WHEN ia.nivel_riesgo = 'Bajo' THEN 1 ELSE 0 END) AS bajo,
            SUM(CASE WHEN ia.nivel_riesgo = 'Medio' THEN 1 ELSE 0 END) AS medio,
            SUM(CASE WHEN ia.nivel_riesgo = 'Alto' THEN 1 ELSE 0 END) AS alto,
            SUM(CASE WHEN ia.nivel_riesgo = 'Crítico' THEN 1 ELSE 0 END) AS critico,
            COUNT(*) AS total
        FROM ia_alertas_desercion ia
        GROUP BY DATE_FORMAT(COALESCE(ia.revisado_en, ia.id_alerta), '%Y-%m')
        ORDER BY mes ASC
        LIMIT 24
    ");
    return $stmt->fetchAll();
}

function obtenerAnalisisPorCarrera(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("
        SELECT
            c.nombre_carrera AS carrera,
            COUNT(ia.id_alerta) AS total_alertas,
            SUM(CASE WHEN ia.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alto_riesgo,
            SUM(CASE WHEN ia.atendida = 0 THEN 1 ELSE 0 END) AS pendientes
        FROM carreras c
        LEFT JOIN alumnos al ON al.id_carrera = c.id_carrera
        LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = al.id_alumno
        GROUP BY c.id_carrera, c.nombre_carrera
        HAVING total_alertas > 0
        ORDER BY total_alertas DESC
    ");
    return $stmt->fetchAll();
}

function obtenerMateriasCriticas(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("
        SELECT
            m.nombre_materia AS materia,
            COUNT(DISTINCT kh.id_alumno) AS alumnos_evaluados,
            ROUND(AVG(kh.calificacion), 1) AS promedio,
            SUM(CASE WHEN kh.calificacion < 70 THEN 1 ELSE 0 END) AS reprobados
        FROM materias m
        INNER JOIN kardex_historial_academico kh ON kh.id_materia = m.id_materia
        GROUP BY m.id_materia, m.nombre_materia
        HAVING alumnos_evaluados > 0
        ORDER BY reprobados DESC, promedio ASC
        LIMIT 15
    ");
    $rows = $stmt->fetchAll();
    $result = [];
    foreach ($rows as $m) {
        $prom = toFloat($m['promedio'] ?? 0);
        $result[] = [
            'materia'           => $m['materia'],
            'alumnos_evaluados' => toNum($m['alumnos_evaluados'] ?? 0),
            'promedio'          => $prom,
            'reprobados'        => toNum($m['reprobados'] ?? 0),
            'nivel'             => $prom < 70 ? 'Crítico' : ($prom < 80 ? 'Atención' : 'Estable'),
        ];
    }
    return $result;
}

function obtenerAlertasRecientes(): array
{
    $pdo = dbConnect();
    $stmt = $pdo->query("
        SELECT
            ia.id_alerta, a.matricula,
            u.nombres, u.apellido_paterno, u.apellido_materno,
            ia.nivel_riesgo, ia.puntaje_riesgo, ia.atendida, ia.estado_seguimiento,
            c.nombre_carrera, p.nombre_periodo
        FROM ia_alertas_desercion ia
        INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
        INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
        LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
        LEFT JOIN periodos p ON ia.id_periodo = p.id_periodo
        ORDER BY ia.id_alerta DESC
        LIMIT 15
    ");
    return $stmt->fetchAll();
}

function generarInsights(array $resumen, array $distribucion, array $parciales, array $ciclos, array $progresion, array $porCarrera, array $porMateria): array
{
    $totalDist = 0;
    foreach ($distribucion as $d) $totalDist += toNum($d['total'] ?? 0);
    $criticos = 0; $alto = 0;
    foreach ($distribucion as $d) {
        if (($d['nivel'] ?? '') === 'Crítico') $criticos = toNum($d['total'] ?? 0);
        if (($d['nivel'] ?? '') === 'Alto') $alto = toNum($d['total'] ?? 0);
    }
    $tasaAtencion = $resumen['tasa_atencion'] ?? 0;
    $materiasCriticas = array_slice(array_filter($porMateria, fn($m) => ($m['reprobados'] ?? 0) > 0), 0, 3);
    $tendenciaParciales = 'estable';
    if (count($parciales) >= 2) {
        $last = end($parciales);
        $first = reset($parciales);
        $tendenciaParciales = ($last['promedio_general'] ?? 0) < ($first['promedio_general'] ?? 0) ? 'declive' : 'mejora';
    }

    $lista = [];

    $lista[] = 'RESUMEN INSTITUCIONAL: El sistema SIVACAD registra un total de ' . $resumen['alumnos'] . ' alumnos activos distribuidos en ' . $resumen['grupos'] . ' grupos academicos, con la participacion de ' . $resumen['docentes'] . ' docentes. Durante el periodo ' . $resumen['periodo_activo'] . ' se han generado ' . $resumen['alertas_total'] . ' alertas de desercion, de las cuales ' . $resumen['alertas_pendientes'] . ' se encuentran pendientes de atencion y ' . $resumen['alertas_atendidas'] . ' han sido atendidas, lo que representa una tasa de atencion del ' . $tasaAtencion . '%.';

    if ($criticos > 0) {
        $lista[] = 'RIESGO CRITICO: Se identificaron ' . $criticos . ' casos clasificados como riesgo critico, los cuales requieren intervencion institucional inmediata. Estos alumnos presentan una probabilidad de desercion superior al 75% segun el modelo predictivo basado en promedio general, creditos acumulados, estatus academico y alertas previas. Se recomienda activar el protocolo de acompanamiento intensivo y canalizar a los estudiantes al departamento de tutoria academica dentro de las proximas 24 a 48 horas.';
    }

    if ($alto > 0) {
        $lista[] = 'RIESGO ALTO: Un total de ' . $alto . ' alumnos se encuentran en nivel de riesgo alto (puntaje entre 50 y 74 puntos). Se recomienda priorizar su canalizacion a tutoria academica dentro de las proximas 48 horas habiles, con un plan de acompanamiento personalizado que incluya evaluacion de factores socioeconomicos y academicos.';
    }

    $lista[] = 'ATENCION INSTITUCIONAL: La tasa de atencion institucional es del ' . $tasaAtencion . '%. ' . ($tasaAtencion >= 50 ? 'Este indicador refleja un nivel adecuado de seguimiento de casos. Se sugiere mantener la capacidad de respuesta actual y fortalecer las acciones preventivas.' : 'Este indicador senala que mas de la mitad de las alertas generadas no han sido atendidas aun. Se recomienda reforzar la capacidad de respuesta del equipo de seguimiento academico y establecer metas mensuales de atencion.');

    if (count($materiasCriticas) > 0) {
        $parts = [];
        foreach ($materiasCriticas as $m) {
            $parts[] = $m['materia'] . ' (promedio ' . $m['promedio'] . ', ' . $m['reprobados'] . ' reprobados)';
        }
        $lista[] = 'MATERIAS CRITICAS: Las materias con mayor incidencia en el riesgo de desercion son: ' . implode('; ', $parts) . '. Estas asignaturas concentran la mayor cantidad de reprobaciones y representan un factor critico en la prediccion de abandono escolar. Se recomienda reforzar los programas de tutoria academica y establecer sesiones de regularizacion intensiva en estas materias.';
    }

    if (count($porCarrera) > 0) {
        $maxC = $porCarrera[0];
        $lista[] = 'ANALISIS POR CARRERA: La carrera de ' . $maxC['carrera'] . ' concentra la mayor cantidad de alertas (' . $maxC['total_alertas'] . '), de las cuales ' . $maxC['alto_riesgo'] . ' corresponden a niveles Alto o Critico. Se recomienda realizar un analisis cualitativo particular de esta poblacion para identificar factores institucionales, pedagogicos o socioeconomicos que puedan estar contribuyendo al riesgo de desercion.';
    }

    if (count($parciales) >= 2) {
        $primero = $parciales[0];
        $ultimo  = $parciales[count($parciales) - 1];
        $lista[] = 'TENDENCIA POR PARCIALES: En Parcial ' . $primero['numero_parcial'] . ' se registro un promedio general de ' . $primero['promedio_general'] . ' con una tasa de desercion del ' . $primero['tasa_desercion'] . '%. Para Parcial ' . $ultimo['numero_parcial'] . ', el promedio fue de ' . $ultimo['promedio_general'] . ' con una tasa de desercion del ' . $ultimo['tasa_desercion'] . '%. La tendencia general es de ' . ($tendenciaParciales === 'declive' ? 'declive academico, lo que sugiere un aumento progresivo del riesgo a medida que avanza el ciclo escolar. Se recomienda implementar intervenciones tempranas desde el primer parcial y reforzar el acompanamiento en los periodos intermedios.' : 'mejora progresiva, lo que indica que las intervenciones tempranas estan teniendo un efecto positivo en la retencion escolar. Se sugiere mantener y fortalecer las estrategias actuales.');
    }

    if (count($progresion) > 2) {
        $first = $progresion[0];
        $last  = $progresion[count($progresion) - 1];
        $trend = toNum($last['total'] ?? 0) > toNum($first['total'] ?? 0) ? 'incremento' : 'disminucion';
        $lista[] = 'PROGRESION TEMPORAL: La evolucion mensual de alertas muestra un ' . $trend . ' en la generacion de alertas: de ' . ($first['total'] ?? 0) . ' (' . ($first['mes'] ?? '') . ') a ' . ($last['total'] ?? 0) . ' (' . ($last['mes'] ?? '') . ') casos reportados. Esta tendencia permite evaluar el impacto de las intervenciones implementadas y ajustar la estrategia institucional de retencion de manera oportuna.';
    }

    if (count($ciclos) >= 2) {
        $primero = $ciclos[0];
        $ultimo  = $ciclos[count($ciclos) - 1];
        $lista[] = 'COMPARATIVA ENTRE CICLOS: ' . $primero['ciclo'] . ' reporto ' . $primero['alertas'] . ' alertas con una tasa de desercion del ' . $primero['tasa_desercion'] . '%, mientras que ' . $ultimo['ciclo'] . ' reporto ' . $ultimo['alertas'] . ' alertas con una tasa del ' . $ultimo['tasa_desercion'] . '%. ' . (toNum($ultimo['alertas'] ?? 0) < toNum($primero['alertas'] ?? 0) ? 'Se observa una disminucion de alertas entre ciclos, lo que podria indicar una mejora en las condiciones institucionales y la efectividad de las estrategias de retencion implementadas.' : 'El incremento de alertas entre ciclos sugiere la necesidad de reforzar las estrategias de prevencion y realizar un analisis profundo de los factores institucionales que pudieran estar incidiendo en el aumento del riesgo de desercion.');
    }

    return $lista;
}

// ===== MAIN =====

$outputPath = null;
$download = isset($_GET['download']) && $_GET['download'] === '1';

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

    $folio = 'D-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));

    $data = [
        'periodo_activo'      => $resumen['periodo_activo'],
        'fecha_emision'       => formatFechaMX(),
        'generado_por'        => 'Sistema SIVACAD',
        'folio'               => $folio,
        'resumen'             => $resumen,
        'distribucion_riesgo' => $dist,
        'parciales'           => $parciales,
        'ciclos'              => $ciclos,
        'progresion'          => $progresion,
        'por_carrera'         => $porCarrera,
        'por_materia'         => $porMateria,
        'alertas_recientes'   => $alertas,
        'insights'            => $insights,
    ];

    $html = getDesercionTemplate($data);

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

    try {
        $dompdf->render();
    } catch (Exception $e) {
        throw new RuntimeException('Error al renderizar PDF: ' . $e->getMessage());
    }

    $pdfOutput = $dompdf->output();

    if (PHP_SAPI === 'cli') {
        echo $pdfOutput;
    } else {
        header('Content-Type: application/pdf');
        header('Content-Disposition: ' . ($download ? 'attachment' : 'inline') . '; filename="reporte_desercion_sivacad.pdf"');
        header('Content-Length: ' . strlen($pdfOutput));
        echo $pdfOutput;
    }

    $pdo = null;
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
