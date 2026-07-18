<?php
/**
 * desercion_service.php
 *
 * Servicio único de datos para la IA de Deserción.
 * Consulta MySQL y prepara una estructura de datos unificada
 * para PDF y Excel. Sigue el patrón del módulo kardex.
 */

declare(strict_types=1);

class DesercionService
{
    private ?PDO $pdo = null;
    private string $assetsDir;

    public function __construct()
    {
        $this->assetsDir = realpath(__DIR__ . '/../../frontend/src/assets') ?: __DIR__;
    }

    // ──────────────────────────────────────────────
    // CONEXIÓN
    // ──────────────────────────────────────────────

    private function db(): PDO
    {
        if ($this->pdo === null) {
            $dsn = "mysql:host=localhost;port=3306;dbname=sivacad_isc;charset=utf8mb4";
            $this->pdo = new PDO($dsn, 'root', '', [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return $this->pdo;
    }

    // ──────────────────────────────────────────────
    // AUXILIARES
    // ──────────────────────────────────────────────

    private function toInt(mixed $value, int $fallback = 0): int
    {
        $n = (int)$value;
        return $n ?: $fallback;
    }

    private function toFloat(mixed $value, float $fallback = 0.0): float
    {
        $n = (float)$value;
        return $n ?: $fallback;
    }

    private function getNivel(int $value): string
    {
        return $value >= 75 ? 'Crítico' : ($value >= 50 ? 'Alto' : ($value >= 25 ? 'Medio' : 'Bajo'));
    }

    private function formatFechaMX(?string $date = null): string
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

    /**
     * Convierte una imagen del sistema de archivos a base64 embebible.
     */
    private function imgToBase64(string $relativePath): string
    {
        $path = $this->assetsDir . '/' . ltrim($relativePath, '/');
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

    private function generarFolio(): string
    {
        $now = new DateTime();
        $rand = strtoupper(bin2hex(random_bytes(3)));
        return 'D-' . $now->format('Ymd') . '-' . $rand;
    }

    // ──────────────────────────────────────────────
    // DATOS DE INSTITUCIÓN
    // ──────────────────────────────────────────────

    public function getDatosInstitucion(): array
    {
        return [
            'nombre_institucion'  => 'Tecnológico Nacional de México',
            'nombre_campus'       => 'Instituto Tecnológico Superior de Irapuato',
            'siglas'              => 'TESI',
            'sistema'             => 'SIVACAD',
            'sistema_completo'    => 'Sistema Integral para la Valoración del Conocimiento y Aprovechamiento Académico',
            'logotipo_tecnm'      => $this->imgToBase64('Logo-TecNM.png'),
            'logotipo_sivacad'    => $this->imgToBase64('Logo-SIVACAD.jpeg'),
            'logotipo_tesi'       => $this->imgToBase64('Logo-TESI.png'),
            'watermark'           => $this->imgToBase64('marcadeagua_SIVACAD.jpeg'),
            'version_modulo'      => '1.0.0',
            'dominio'             => 'sivacad.tesi.org.mx',
        ];
    }

    // ──────────────────────────────────────────────
    // DATOS DEL ALUMNO
    // ──────────────────────────────────────────────

    public function getDatosAlumno(int $idAlumno): ?array
    {
        $pdo = $this->db();
        $stmt = $pdo->prepare("
            SELECT
                a.id_alumno,
                a.nombres,
                a.apellido_paterno,
                a.apellido_materno,
                a.matricula,
                a.curp,
                a.semestre_actual,
                a.fotografia,
                a.estatus_academico,
                a.id_carrera,
                u.correo_institucional,
                c.nombre_carrera
            FROM alumnos a
            LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
            LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
            WHERE a.id_alumno = ?
            LIMIT 1
        ");
        $stmt->execute([$idAlumno]);
        $row = $stmt->fetch();

        if (!$row) {
            return null;
        }

        $nombreCompleto = trim(
            ($row['nombres'] ?? '') . ' ' .
            ($row['apellido_paterno'] ?? '') . ' ' .
            ($row['apellido_materno'] ?? '')
        );

        return [
            'id_alumno'          => (int)$row['id_alumno'],
            'nombres'            => $row['nombres'] ?? '',
            'apellido_paterno'   => $row['apellido_paterno'] ?? '',
            'apellido_materno'   => $row['apellido_materno'] ?? '',
            'nombre_completo'    => $nombreCompleto,
            'matricula'          => $row['matricula'] ?? '',
            'curp'               => $row['curp'] ?? '',
            'semestre_actual'    => (int)($row['semestre_actual'] ?? 0),
            'fotografia'         => $row['fotografia'] ?? '',
            'estatus_academico'  => $row['estatus_academico'] ?? 'Regular',
            'id_carrera'         => (int)($row['id_carrera'] ?? 0),
            'correo_institucional' => $row['correo_institucional'] ?? '',
            'nombre_carrera'     => $row['nombre_carrera'] ?? '',
        ];
    }

    // ──────────────────────────────────────────────
    // DATOS DE CARRERA
    // ──────────────────────────────────────────────

    public function getDatosCarrera(int $idCarrera): ?array
    {
        $pdo = $this->db();
        $stmt = $pdo->prepare("
            SELECT id_carrera, nombre_carrera
            FROM carreras
            WHERE id_carrera = ?
            LIMIT 1
        ");
        $stmt->execute([$idCarrera]);
        $row = $stmt->fetch();

        if (!$row) {
            return null;
        }

        return [
            'id_carrera'      => (int)$row['id_carrera'],
            'nombre_carrera'  => $row['nombre_carrera'],
        ];
    }

    // ──────────────────────────────────────────────
    // DATOS DE GRUPO DEL ALUMNO
    // ──────────────────────────────────────────────

    public function getDatosGrupo(int $idAlumno): ?array
    {
        $pdo = $this->db();
        $stmt = $pdo->prepare("
            SELECT
                g.id_grupo,
                g.nombre_grupo,
                g.semestre,
                g.turno,
                g.estado
            FROM grupo_alumnos ga
            INNER JOIN grupos g ON ga.id_grupo = g.id_grupo
            WHERE ga.id_alumno = ?
            ORDER BY ga.id_asignacion DESC
            LIMIT 1
        ");
        $stmt->execute([$idAlumno]);
        $row = $stmt->fetch();

        if (!$row) {
            return [
                'id_grupo'     => 0,
                'nombre_grupo' => 'Sin asignar',
                'semestre'     => 0,
                'turno'        => '',
                'estado'       => '',
            ];
        }

        return [
            'id_grupo'     => (int)$row['id_grupo'],
            'nombre_grupo' => $row['nombre_grupo'],
            'semestre'     => (int)$row['semestre'],
            'turno'        => $row['turno'],
            'estado'       => $row['estado'],
        ];
    }

    // ──────────────────────────────────────────────
    // DATOS DEL PERIODO
    // ──────────────────────────────────────────────

    public function getPeriodoActivo(): array
    {
        $pdo = $this->db();
        $stmt = $pdo->query("
            SELECT
                id_periodo,
                nombre_periodo,
                fecha_inicio,
                fecha_fin,
                estado
            FROM periodos
            WHERE LOWER(estado) = 'activo'
            ORDER BY id_periodo DESC
            LIMIT 1
        ");
        $row = $stmt->fetch();

        if (!$row) {
            return [
                'id_periodo'     => 0,
                'nombre_periodo' => 'N/D',
                'fecha_inicio'   => null,
                'fecha_fin'      => null,
                'estado'         => 'Inactivo',
            ];
        }

        return [
            'id_periodo'     => (int)$row['id_periodo'],
            'nombre_periodo' => $row['nombre_periodo'],
            'fecha_inicio'   => $row['fecha_inicio'],
            'fecha_fin'      => $row['fecha_fin'],
            'estado'         => $row['estado'],
        ];
    }

    // ──────────────────────────────────────────────
    // RESULTADOS DE LA ALERTA DEL ALUMNO
    // ──────────────────────────────────────────────

    public function getAlertaAlumno(int $idAlumno, ?int $idPeriodo = null): ?array
    {
        $pdo = $this->db();

        $sql = "
            SELECT
                ia.id_alerta,
                ia.id_alumno,
                ia.id_periodo,
                ia.nivel_riesgo,
                ia.puntaje_riesgo,
                ia.descripcion,
                ia.recomendacion,
                ia.atendida,
                ia.modelo_version,
                ia.factores_json,
                ia.explicacion,
                ia.estado_seguimiento,
                ia.responsable_id,
                ia.revisado_en,
                p.nombre_periodo
            FROM ia_alertas_desercion ia
            LEFT JOIN periodos p ON ia.id_periodo = p.id_periodo
            WHERE ia.id_alumno = ?
        ";
        $params = [$idAlumno];

        if ($idPeriodo !== null) {
            $sql .= " AND ia.id_periodo = ?";
            $params[] = $idPeriodo;
        }

        $sql .= " ORDER BY ia.id_alerta DESC LIMIT 1";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();

        if (!$row) {
            return null;
        }

        $factores = null;
        if (!empty($row['factores_json'])) {
            $factores = json_decode($row['factores_json'], true);
        }

        return [
            'id_alerta'          => (int)$row['id_alerta'],
            'id_alumno'          => (int)$row['id_alumno'],
            'id_periodo'         => (int)$row['id_periodo'],
            'nivel_riesgo'       => $row['nivel_riesgo'] ?? 'Bajo',
            'puntaje_riesgo'     => $this->toFloat($row['puntaje_riesgo'] ?? 0),
            'descripcion'        => $row['descripcion'] ?? '',
            'recomendacion'      => $row['recomendacion'] ?? '',
            'atendida'           => (bool)($row['atendida'] ?? false),
            'modelo_version'     => $row['modelo_version'] ?? '',
            'factores'           => $factores,
            'explicacion'        => $row['explicacion'] ?? '',
            'estado_seguimiento' => $row['estado_seguimiento'] ?? 'Pendiente',
            'responsable_id'     => $this->toInt($row['responsable_id'] ?? 0),
            'revisado_en'        => $row['revisado_en'] ?? null,
            'nombre_periodo'     => $row['nombre_periodo'] ?? '',
        ];
    }

    // ──────────────────────────────────────────────
    // ESTADO ACADÉMICO DEL ALUMNO
    // ──────────────────────────────────────────────

    public function getEstadoAcademico(int $idAlumno): array
    {
        $pdo = $this->db();

        $stmt = $pdo->prepare("
            SELECT
                ROUND(AVG(calificacion), 2) AS promedio_general,
                COUNT(*) AS materias_cursadas,
                SUM(CASE WHEN calificacion >= 70 THEN 1 ELSE 0 END) AS materias_acreditadas,
                SUM(CASE WHEN calificacion < 70 AND calificacion > 0 THEN 1 ELSE 0 END) AS materias_reprobadas,
                SUM(CASE WHEN calificacion IS NULL OR calificacion = 0 THEN 1 ELSE 0 END) AS materias_sin_calificacion,
                SUM(creditos) AS creditos_acumulados
            FROM kardex_historial_academico
            WHERE id_alumno = ?
        ");
        $stmt->execute([$idAlumno]);
        $row = $stmt->fetch();

        $cursadas = $this->toInt($row['materias_cursadas'] ?? 0);
        $acreditadas = $this->toInt($row['materias_acreditadas'] ?? 0);

        return [
            'promedio_general'          => $this->toFloat($row['promedio_general'] ?? 0),
            'materias_cursadas'         => $cursadas,
            'materias_acreditadas'      => $acreditadas,
            'materias_reprobadas'       => $this->toInt($row['materias_reprobadas'] ?? 0),
            'materias_sin_calificacion' => $this->toInt($row['materias_sin_calificacion'] ?? 0),
            'creditos_acumulados'       => $this->toFloat($row['creditos_acumulados'] ?? 0),
            'porcentaje_aprobacion'     => $cursadas > 0 ? round(($acreditadas / $cursadas) * 100, 1) : 0,
        ];
    }

    // ──────────────────────────────────────────────
    // MOTIVO DE ALERTA
    // ──────────────────────────────────────────────

    public function getMotivoAlerta(int $idAlerta): ?string
    {
        $pdo = $this->db();
        $stmt = $pdo->prepare("
            SELECT descripcion FROM ia_alertas_desercion WHERE id_alerta = ? LIMIT 1
        ");
        $stmt->execute([$idAlerta]);
        $row = $stmt->fetch();

        return $row ? $row['descripcion'] : null;
    }

    // ──────────────────────────────────────────────
    // SEGUIMIENTOS / OBSERVACIONES
    // ──────────────────────────────────────────────

    public function getObservaciones(int $idAlerta): array
    {
        $pdo = $this->db();
        $stmt = $pdo->prepare("
            SELECT
                s.id_seguimiento,
                s.accion,
                s.observaciones,
                s.estado,
                s.id_usuario,
                u.nombres AS usuario_nombres,
                u.apellido_paterno AS usuario_apaterno,
                u.apellido_materno AS usuario_amaterno
            FROM ia_seguimientos_desercion s
            LEFT JOIN usuarios u ON s.id_usuario = u.id_usuario
            WHERE s.id_alerta = ?
            ORDER BY s.id_seguimiento ASC
        ");
        $stmt->execute([$idAlerta]);
        $rows = $stmt->fetchAll();

        $result = [];
        foreach ($rows as $r) {
            $nombreUsuario = trim(
                ($r['usuario_nombres'] ?? '') . ' ' .
                ($r['usuario_apaterno'] ?? '') . ' ' .
                ($r['usuario_amaterno'] ?? '')
            );
            $result[] = [
                'id_seguimiento' => (int)$r['id_seguimiento'],
                'accion'         => $r['accion'] ?? '',
                'observaciones'  => $r['observaciones'] ?? '',
                'estado'         => $r['estado'] ?? 'Pendiente',
                'id_usuario'     => $this->toInt($r['id_usuario'] ?? 0),
                'usuario_nombre' => $nombreUsuario ?: 'Sistema',
            ];
        }

        return $result;
    }

    // ──────────────────────────────────────────────
    // RECOMENDACIONES DE LA IA
    // ──────────────────────────────────────────────

    public function getRecomendaciones(?int $idAlumno = null): array
    {
        $pdo = $this->db();

        if ($idAlumno !== null) {
            $stmt = $pdo->prepare("
                SELECT recomendacion FROM ia_alertas_desercion
                WHERE id_alumno = ? AND recomendacion IS NOT NULL AND recomendacion != ''
                ORDER BY id_alerta DESC
                LIMIT 5
            ");
            $stmt->execute([$idAlumno]);
        } else {
            $stmt = $pdo->query("
                SELECT recomendacion FROM ia_alertas_desercion
                WHERE recomendacion IS NOT NULL AND recomendacion != ''
                ORDER BY id_alerta DESC
                LIMIT 10
            ");
        }

        $rows = $stmt->fetchAll();
        $recomendaciones = [];
        foreach ($rows as $r) {
            $recomendaciones[] = $r['recomendacion'];
        }

        return $recomendaciones;
    }

    // ──────────────────────────────────────────────
    // FIRMAS (electrónicas del módulo)
    // ──────────────────────────────────────────────

    public function getFirmas(): array
    {
        $pdo = $this->db();
        $stmt = $pdo->query("
            SELECT id_auditoria, id_usuario, accion, creado_en
            FROM ia_auditoria_desercion
            ORDER BY id_auditoria DESC
            LIMIT 5
        ");
        $rows = $stmt->fetchAll();

        $firmas = [];
        foreach ($rows as $r) {
            $firmas[] = [
                'id_auditoria' => (int)$r['id_auditoria'],
                'id_usuario'   => $this->toInt($r['id_usuario'] ?? 0),
                'accion'       => $r['accion'] ?? '',
                'creado_en'    => $r['creado_en'] ?? '',
            ];
        }

        return $firmas;
    }

    // ──────────────────────────────────────────────
    // SELLOS INSTITUCIONALES
    // ──────────────────────────────────────────────

    public function getSellos(): array
    {
        $pdo = $this->db();
        $stmt = $pdo->query("
            SELECT tipo, titulo, descripcion FROM kardex_sellos WHERE activo = 1 LIMIT 3
        ");
        $rows = $stmt->fetchAll();

        if (count($rows) === 0) {
            return [
                ['tipo' => 'sivacad', 'titulo' => 'Sello SIVACAD', 'descripcion' => 'Sello oficial del Sistema Integral para la Valoración del Conocimiento y Aprovechamiento Académico'],
                ['tipo' => 'division_isc', 'titulo' => 'Sello División ISC', 'descripcion' => 'Sello de la División de Ingeniería en Sistemas Computacionales'],
                ['tipo' => 'control_escolar', 'titulo' => 'Sello Control Escolar', 'descripcion' => 'Sello oficial de Control Escolar'],
            ];
        }

        return $rows;
    }

    // ──────────────────────────────────────────────
    // FOTOGRAFÍA DEL ALUMNO (base64)
    // ──────────────────────────────────────────────

    public function getFotografiaUrl(int $idAlumno): string
    {
        $pdo = $this->db();
        $stmt = $pdo->prepare("
            SELECT fotografia FROM alumnos WHERE id_alumno = ? LIMIT 1
        ");
        $stmt->execute([$idAlumno]);
        $row = $stmt->fetch();

        $fotoPath = $row['fotografia'] ?? '';
        if (!$fotoPath) {
            return '';
        }

        if (file_exists($fotoPath)) {
            return $this->imgToBase64($fotoPath) ?: $this->imgToBase64($fotoPath);
        }

        if (filter_var($fotoPath, FILTER_VALIDATE_URL)) {
            $ctx = stream_context_create(['http' => ['timeout' => 5]]);
            $content = @file_get_contents($fotoPath, false, $ctx);
            if ($content !== false) {
                return 'data:image/jpeg;base64,' . base64_encode($content);
            }
        }

        $absolute = $this->assetsDir . '/' . ltrim($fotoPath, '/');
        if (file_exists($absolute)) {
            return $this->imgToBase64($absolute);
        }

        return '';
    }

    // ──────────────────────────────────────────────
    // INDICADORES AGREGADOS DE DESERCIÓN
    // ──────────────────────────────────────────────

    public function getIndicadoresDesercion(): array
    {
        $pdo = $this->db();

        $stmt = $pdo->query("
            SELECT
                (SELECT COUNT(*) FROM alumnos) AS total_alumnos,
                (SELECT COUNT(*) FROM docentes) AS total_docentes,
                (SELECT COUNT(*) FROM grupos) AS total_grupos,
                (SELECT COUNT(*) FROM evaluaciones WHERE LOWER(estado) = 'activa') AS evaluaciones_activas,
                (SELECT COUNT(*) FROM ia_alertas_desercion) AS alertas_totales,
                (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 0) AS alertas_pendientes,
                (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 1) AS alertas_atendidas
        ");
        $row = $stmt->fetch();

        $totalAlertas = $this->toInt($row['alertas_totales'] ?? 0);
        $atendidas = $this->toInt($row['alertas_atendidas'] ?? 0);

        return [
            'total_alumnos'       => $this->toInt($row['total_alumnos'] ?? 0),
            'total_docentes'      => $this->toInt($row['total_docentes'] ?? 0),
            'total_grupos'        => $this->toInt($row['total_grupos'] ?? 0),
            'evaluaciones_activas' => $this->toInt($row['evaluaciones_activas'] ?? 0),
            'alertas_totales'     => $totalAlertas,
            'alertas_pendientes'  => $this->toInt($row['alertas_pendientes'] ?? 0),
            'alertas_atendidas'   => $atendidas,
            'tasa_atencion'       => $totalAlertas > 0 ? round(($atendidas / $totalAlertas) * 100) : 0,
        ];
    }

    // ──────────────────────────────────────────────
    // DISTRIBUCIÓN DE RIESGO
    // ──────────────────────────────────────────────

    public function getDistribucionRiesgo(): array
    {
        $pdo = $this->db();
        $stmt = $pdo->query("
            SELECT nivel_riesgo AS nivel, COUNT(*) AS total
            FROM ia_alertas_desercion
            GROUP BY nivel_riesgo
            ORDER BY FIELD(nivel_riesgo, 'Bajo', 'Medio', 'Alto', 'Crítico')
        ");
        $rows = $stmt->fetchAll();

        $totalDist = 0;
        foreach ($rows as $r) {
            $totalDist += $this->toInt($r['total'] ?? 0);
        }

        $result = [];
        foreach ($rows as $r) {
            $total = $this->toInt($r['total'] ?? 0);
            $result[] = [
                'nivel'      => $r['nivel'],
                'total'      => $total,
                'porcentaje' => $totalDist > 0 ? round(($total / $totalDist) * 100, 1) : 0,
            ];
        }

        return $result;
    }

    // ──────────────────────────────────────────────
    // ANÁLISIS POR PARCIALES
    // ──────────────────────────────────────────────

    public function getAnalisisParciales(): array
    {
        $pdo = $this->db();
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
            $activos = $this->toInt($p['total_activos'] ?? 0);
            $desertores = $this->toInt($p['total_desertores'] ?? 0);
            $totalAlumnos = $activos + $desertores;
            $tasa = $totalAlumnos > 0 ? round(($desertores / $totalAlumnos) * 100) : 0;
            $result[] = [
                'numero_parcial'     => (int)$p['numero_parcial'],
                'promedio_general'   => $this->toFloat($p['promedio_general'] ?? 0),
                'total_riesgos'      => $this->toInt($p['total_riesgos'] ?? 0),
                'total_reprobadas'   => $this->toInt($p['total_reprobadas'] ?? 0),
                'alumnos_afectados'  => $this->toInt($p['alumnos_afectados'] ?? 0),
                'total_activos'      => $activos,
                'total_desertores'   => $desertores,
                'total_alumnos'      => $totalAlumnos,
                'tasa_desercion'     => $tasa,
                'nivel_riesgo'       => $this->getNivel((int)$tasa),
            ];
        }

        return $result;
    }

    // ──────────────────────────────────────────────
    // COMPARATIVA POR CICLOS
    // ──────────────────────────────────────────────

    public function getComparativaCiclos(): array
    {
        $pdo = $this->db();
        $stmt = $pdo->query("
            SELECT
                p.nombre_periodo AS ciclo,
                COUNT(ia.id_alerta) AS alertas,
                SUM(CASE WHEN ia.nivel_riesgo IN ('Alto', 'Crítico') THEN 1 ELSE 0 END) AS alto_riesgo,
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
            $alertas = $this->toInt($c['alertas'] ?? 0);
            $alumnos = $this->toInt($c['total_alumnos'] ?? 0);
            $result[] = [
                'ciclo'           => $c['ciclo'],
                'alertas'         => $alertas,
                'alto_riesgo'     => $this->toInt($c['alto_riesgo'] ?? 0),
                'riesgo_promedio' => $this->toFloat($c['riesgo_promedio'] ?? 0),
                'total_alumnos'   => $alumnos,
                'tasa_desercion'  => $alumnos > 0 ? round(($alertas / $alumnos) * 100) : 0,
            ];
        }

        return $result;
    }

    // ──────────────────────────────────────────────
    // PROGRESIÓN TEMPORAL
    // ──────────────────────────────────────────────

    public function getProgresionTemporal(): array
    {
        $pdo = $this->db();
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
        $rows = $stmt->fetchAll();

        $result = [];
        foreach ($rows as $r) {
            $result[] = [
                'mes'     => $r['mes'],
                'bajo'    => $this->toInt($r['bajo'] ?? 0),
                'medio'   => $this->toInt($r['medio'] ?? 0),
                'alto'    => $this->toInt($r['alto'] ?? 0),
                'critico' => $this->toInt($r['critico'] ?? 0),
                'total'   => $this->toInt($r['total'] ?? 0),
            ];
        }

        return $result;
    }

    // ──────────────────────────────────────────────
    // ANÁLISIS POR CARRERA
    // ──────────────────────────────────────────────

    public function getAnalisisPorCarrera(): array
    {
        $pdo = $this->db();
        $stmt = $pdo->query("
            SELECT
                c.nombre_carrera AS carrera,
                COUNT(ia.id_alerta) AS total_alertas,
                SUM(CASE WHEN ia.nivel_riesgo IN ('Alto', 'Crítico') THEN 1 ELSE 0 END) AS alto_riesgo,
                SUM(CASE WHEN ia.atendida = 0 THEN 1 ELSE 0 END) AS pendientes
            FROM carreras c
            LEFT JOIN alumnos al ON al.id_carrera = c.id_carrera
            LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = al.id_alumno
            GROUP BY c.id_carrera, c.nombre_carrera
            HAVING total_alertas > 0
            ORDER BY total_alertas DESC
        ");
        $rows = $stmt->fetchAll();

        $result = [];
        foreach ($rows as $r) {
            $result[] = [
                'carrera'       => $r['carrera'],
                'total_alertas' => $this->toInt($r['total_alertas'] ?? 0),
                'alto_riesgo'   => $this->toInt($r['alto_riesgo'] ?? 0),
                'pendientes'    => $this->toInt($r['pendientes'] ?? 0),
            ];
        }

        return $result;
    }

    // ──────────────────────────────────────────────
    // MATERIAS CRÍTICAS
    // ──────────────────────────────────────────────

    public function getMateriasCriticas(): array
    {
        $pdo = $this->db();
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
            $prom = $this->toFloat($m['promedio'] ?? 0);
            $result[] = [
                'materia'           => $m['materia'],
                'alumnos_evaluados' => $this->toInt($m['alumnos_evaluados'] ?? 0),
                'promedio'          => $prom,
                'reprobados'        => $this->toInt($m['reprobados'] ?? 0),
                'nivel'             => $prom < 70 ? 'Crítico' : ($prom < 80 ? 'Atención' : 'Estable'),
            ];
        }

        return $result;
    }

    // ──────────────────────────────────────────────
    // ALERTAS RECIENTES
    // ──────────────────────────────────────────────

    public function getAlertasRecientes(int $limite = 15): array
    {
        $pdo = $this->db();
        $stmt = $pdo->query("
            SELECT
                ia.id_alerta,
                a.matricula,
                u.nombres,
                u.apellido_paterno,
                u.apellido_materno,
                ia.nivel_riesgo,
                ia.puntaje_riesgo,
                ia.atendida,
                ia.estado_seguimiento,
                c.nombre_carrera,
                p.nombre_periodo
            FROM ia_alertas_desercion ia
            INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
            INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
            LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
            LEFT JOIN periodos p ON ia.id_periodo = p.id_periodo
            ORDER BY ia.id_alerta DESC
            LIMIT {$limite}
        ");
        $rows = $stmt->fetchAll();

        $result = [];
        foreach ($rows as $r) {
            $nombreCompleto = trim(
                ($r['nombres'] ?? '') . ' ' .
                ($r['apellido_paterno'] ?? '') . ' ' .
                ($r['apellido_materno'] ?? '')
            );
            $result[] = [
                'id_alerta'         => (int)$r['id_alerta'],
                'matricula'         => $r['matricula'] ?? '',
                'nombres'           => $r['nombres'] ?? '',
                'apellido_paterno'  => $r['apellido_paterno'] ?? '',
                'apellido_materno'  => $r['apellido_materno'] ?? '',
                'nombre_completo'   => $nombreCompleto,
                'nivel_riesgo'      => $r['nivel_riesgo'] ?? '',
                'puntaje_riesgo'    => $this->toFloat($r['puntaje_riesgo'] ?? 0),
                'atendida'          => (bool)($r['atendida'] ?? false),
                'estado_seguimiento' => $r['estado_seguimiento'] ?? 'Pendiente',
                'nombre_carrera'    => $r['nombre_carrera'] ?? '',
                'nombre_periodo'    => $r['nombre_periodo'] ?? '',
            ];
        }

        return $result;
    }

    // ──────────────────────────────────────────────
    // INSIGHTS ESTRATÉGICOS
    // ──────────────────────────────────────────────

    public function generarInsights(): array
    {
        $resumen      = $this->getIndicadoresDesercion();
        $distribucion = $this->getDistribucionRiesgo();
        $parciales    = $this->getAnalisisParciales();
        $ciclos       = $this->getComparativaCiclos();
        $progresion   = $this->getProgresionTemporal();
        $porCarrera   = $this->getAnalisisPorCarrera();
        $porMateria   = $this->getMateriasCriticas();

        $totalDist = 0;
        foreach ($distribucion as $d) $totalDist += $this->toInt($d['total'] ?? 0);
        $criticos = 0; $alto = 0;
        foreach ($distribucion as $d) {
            $n = $d['nivel'] ?? '';
            if ($n === 'Crítico') $criticos = $this->toInt($d['total'] ?? 0);
            if ($n === 'Alto') $alto = $this->toInt($d['total'] ?? 0);
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

        $lista[] = 'RESUMEN INSTITUCIONAL: El sistema SIVACAD registra un total de ' . $resumen['total_alumnos'] . ' alumnos activos distribuidos en ' . $resumen['total_grupos'] . ' grupos academicos, con la participacion de ' . $resumen['total_docentes'] . ' docentes. Durante el periodo actual se han generado ' . $resumen['alertas_totales'] . ' alertas de desercion, de las cuales ' . $resumen['alertas_pendientes'] . ' se encuentran pendientes de atencion y ' . $resumen['alertas_atendidas'] . ' han sido atendidas, lo que representa una tasa de atencion del ' . $tasaAtencion . '%.';

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
            $trend = $this->toInt($last['total'] ?? 0) > $this->toInt($first['total'] ?? 0) ? 'incremento' : 'disminucion';
            $lista[] = 'PROGRESION TEMPORAL: La evolucion mensual de alertas muestra un ' . $trend . ' en la generacion de alertas: de ' . ($first['total'] ?? 0) . ' (' . ($first['mes'] ?? '') . ') a ' . ($last['total'] ?? 0) . ' (' . ($last['mes'] ?? '') . ') casos reportados. Esta tendencia permite evaluar el impacto de las intervenciones implementadas y ajustar la estrategia institucional de retencion de manera oportuna.';
        }

        if (count($ciclos) >= 2) {
            $primero = $ciclos[0];
            $ultimo  = $ciclos[count($ciclos) - 1];
            $lista[] = 'COMPARATIVA ENTRE CICLOS: ' . $primero['ciclo'] . ' reporto ' . $primero['alertas'] . ' alertas con una tasa de desercion del ' . $primero['tasa_desercion'] . '%, mientras que ' . $ultimo['ciclo'] . ' reporto ' . $ultimo['alertas'] . ' alertas con una tasa del ' . $ultimo['tasa_desercion'] . '%. ' . ($this->toInt($ultimo['alertas'] ?? 0) < $this->toInt($primero['alertas'] ?? 0) ? 'Se observa una disminucion de alertas entre ciclos, lo que podria indicar una mejora en las condiciones institucionales y la efectividad de las estrategias de retencion implementadas.' : 'El incremento de alertas entre ciclos sugiere la necesidad de reforzar las estrategias de prevencion y realizar un analisis profundo de los factores institucionales que pudieran estar incidiendo en el aumento del riesgo de desercion.');
        }

        return $lista;
    }

    // ──────────────────────────────────────────────
    // DATOS PARA GRÁFICA DE RIESGO
    // ──────────────────────────────────────────────

    public function getGraficaRiesgo(): array
    {
        return $this->getDistribucionRiesgo();
    }

    // ──────────────────────────────────────────────
    // DATOS PARA GRÁFICA DE TENDENCIA
    // ──────────────────────────────────────────────

    public function getGraficaTendencia(): array
    {
        return $this->getProgresionTemporal();
    }

    // ──────────────────────────────────────────────
    // REPORTE COMPLETO (institucional)
    // ──────────────────────────────────────────────

    public function compilarReporteInstitucional(): array
    {
        $institucion     = $this->getDatosInstitucion();
        $periodo         = $this->getPeriodoActivo();
        $indicadores     = $this->getIndicadoresDesercion();
        $distribucion    = $this->getDistribucionRiesgo();
        $parciales       = $this->getAnalisisParciales();
        $ciclos          = $this->getComparativaCiclos();
        $progresion      = $this->getProgresionTemporal();
        $porCarrera      = $this->getAnalisisPorCarrera();
        $porMateria      = $this->getMateriasCriticas();
        $alertas         = $this->getAlertasRecientes();
        $insights        = $this->generarInsights();
        $sellos          = $this->getSellos();
        $firmas          = $this->getFirmas();

        return [
            'datos_institucion'     => $institucion,
            'datos_periodo'         => $periodo,
            'datos_alumno'          => null,
            'datos_carrera'         => null,
            'datos_grupo'           => null,
            'fotografia_url'        => '',
            'estado_academico'      => null,
            'motivo_alerta'         => null,
            'indicadores_desercion' => $indicadores,
            'distribucion_riesgo'   => $distribucion,
            'parciales'             => $parciales,
            'ciclos'                => $ciclos,
            'progresion_temporal'   => $progresion,
            'analisis_carrera'      => $porCarrera,
            'materias_criticas'     => $porMateria,
            'alertas_recientes'     => $alertas,
            'resumen_ia'            => $insights,
            'observaciones'         => [],
            'recomendaciones'       => $this->getRecomendaciones(),
            'firmas'                => $firmas,
            'sellos'                => $sellos,
            'grafica_riesgo'        => $distribucion,
            'grafica_tendencia'     => $progresion,
            'folio'                 => $this->generarFolio(),
            'fecha_emision'         => $this->formatFechaMX(),
            'zona_horaria'          => 'America/Mexico_City',
        ];
    }

    // ──────────────────────────────────────────────
    // REPORTE COMPLETO (por alumno)
    // ──────────────────────────────────────────────

    public function compilarReporteAlumno(int $idAlumno): array
    {
        $alumno   = $this->getDatosAlumno($idAlumno);
        if ($alumno === null) {
            throw new InvalidArgumentException("Alumno con id {$idAlumno} no encontrado.");
        }

        $institucion  = $this->getDatosInstitucion();
        $periodo      = $this->getPeriodoActivo();
        $carrera      = $this->getDatosCarrera($alumno['id_carrera']);
        $grupo        = $this->getDatosGrupo($idAlumno);
        $alerta       = $this->getAlertaAlumno($idAlumno, $periodo['id_periodo'] ?: null);
        $estadoAcad   = $this->getEstadoAcademico($idAlumno);
        $fotoUrl      = $this->getFotografiaUrl($idAlumno);

        $observaciones = [];
        $recomendaciones = [];
        $motivoAlerta = null;
        $idAlerta = 0;

        if ($alerta !== null) {
            $idAlerta = $alerta['id_alerta'];
            $observaciones = $this->getObservaciones($idAlerta);
            $recomendaciones = [$alerta['recomendacion']];
            $motivoAlerta = $alerta['descripcion'];
        }

        $distribucion  = $this->getDistribucionRiesgo();
        $parciales     = $this->getAnalisisParciales();
        $ciclos        = $this->getComparativaCiclos();
        $progresion    = $this->getProgresionTemporal();
        $porCarrera    = $this->getAnalisisPorCarrera();
        $porMateria    = $this->getMateriasCriticas();
        $alertas       = $this->getAlertasRecientes();
        $insights      = $this->generarInsights();
        $sellos        = $this->getSellos();
        $firmas        = $this->getFirmas();

        return [
            'datos_institucion'     => $institucion,
            'datos_periodo'         => $periodo,
            'datos_alumno'          => $alumno,
            'datos_carrera'         => $carrera,
            'datos_grupo'           => $grupo,
            'fotografia_url'        => $fotoUrl,
            'estado_academico'      => $estadoAcad,
            'motivo_alerta'         => $motivoAlerta,
            'id_alerta'             => $idAlerta,
            'alerta'                => $alerta,
            'indicadores_desercion' => [
                'total_alumnos'       => 0,
                'total_docentes'      => 0,
                'total_grupos'        => 0,
                'evaluaciones_activas' => 0,
                'alertas_totales'     => 0,
                'alertas_pendientes'  => 0,
                'alertas_atendidas'   => 0,
                'tasa_atencion'       => 0,
            ],
            'distribucion_riesgo'   => $distribucion,
            'parciales'             => $parciales,
            'ciclos'                => $ciclos,
            'progresion_temporal'   => $progresion,
            'analisis_carrera'      => $porCarrera,
            'materias_criticas'     => $porMateria,
            'alertas_recientes'     => $alertas,
            'resumen_ia'            => $insights,
            'observaciones'         => $observaciones,
            'recomendaciones'       => $recomendaciones,
            'firmas'                => $firmas,
            'sellos'                => $sellos,
            'grafica_riesgo'        => $distribucion,
            'grafica_tendencia'     => $progresion,
            'folio'                 => $this->generarFolio(),
            'fecha_emision'         => $this->formatFechaMX(),
            'zona_horaria'          => 'America/Mexico_City',
        ];
    }
}
