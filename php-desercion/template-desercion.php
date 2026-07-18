<?php
/**
 * template-desercion.php
 *
 * Plantilla PDF oficial del módulo de IA de Deserción.
 * Compatible con Dompdf. Recibe datos ya estructurados
 * y renderiza el documento institucional.
 *
 * Uso: $html = getDesercionTemplate($data);
 */

function getDesercionTemplate(array $d): string
{
    // ──────────────────────────────────────────────
    // DATOS DE INSTITUCIÓN
    // ──────────────────────────────────────────────
    $inst     = $d['datos_institucion'] ?? [];
    $periodo  = $d['datos_periodo'] ?? [];
    $alumno   = $d['datos_alumno'];
    $carrera  = $d['datos_carrera'];
    $grupo    = $d['datos_grupo'];
    $estadoAc = $d['estado_academico'];
    $indic    = $d['indicadores_desercion'] ?? [];
    $dist     = $d['distribucion_riesgo'] ?? [];
    $parciales = $d['parciales'] ?? [];
    $ciclos   = $d['ciclos'] ?? [];
    $progres  = $d['progresion_temporal'] ?? [];
    $porCarr  = $d['analisis_carrera'] ?? [];
    $porMat   = $d['materias_criticas'] ?? [];
    $alertas  = $d['alertas_recientes'] ?? [];
    $insights = $d['resumen_ia'] ?? [];
    $observ   = $d['observaciones'] ?? [];
    $recom    = $d['recomendaciones'] ?? [];
    $sellos   = $d['sellos'] ?? [];
    $folio    = hsc($d['folio'] ?? '—');
    $fecha    = hsc($d['fecha_emision'] ?? date('d/m/Y H:i:s'));
    $zona     = hsc($d['zona_horaria'] ?? 'America/Mexico_City');
    $fotoUrl  = $d['fotografia_url'] ?? '';
    $motivo   = $d['motivo_alerta'];

    $periodoNombre = hsc($periodo['nombre_periodo'] ?? 'N/D');
    $hayAlumno     = $alumno !== null && is_array($alumno);

    // Logos
    $logo_tecnm   = hsc($inst['logotipo_tecnm'] ?? '');
    $logo_sivacad = hsc($inst['logotipo_sivacad'] ?? '');
    $logo_tesi    = hsc($inst['logotipo_tesi'] ?? '');
    $watermark    = hsc($inst['watermark'] ?? '');
    $nomInst      = hsc($inst['nombre_institucion'] ?? 'Tecnologico Nacional de Mexico');
    $nomCampus    = hsc($inst['nombre_campus'] ?? 'Instituto Tecnologico Superior de Irapuato');
    $siglas       = hsc($inst['siglas'] ?? 'TESI');
    $sistema      = hsc($inst['sistema_completo'] ?? 'Sistema Integral para la Valoracion del Conocimiento y Aprovechamiento Academico');

    $wmStyle = $watermark ? "background-image: url('{$watermark}');" : '';

    // ──────────────────────────────────────────────
    // DATOS DEL ALUMNO
    // ──────────────────────────────────────────────
    $alumnoNombre  = $hayAlumno ? hsc($alumno['nombre_completo'] ?? '—') : '—';
    $alumnoMat     = $hayAlumno ? hsc($alumno['matricula'] ?? '—') : '—';
    $alumnoCURP    = $hayAlumno ? hsc($alumno['curp'] ?? '—') : '—';
    $alumnoSem     = $hayAlumno ? hsc((string)($alumno['semestre_actual'] ?? '—')) : '—';
    $alumnoEstatus = $hayAlumno ? hsc($alumno['estatus_academico'] ?? '—') : '—';
    $alumnoCorreo  = $hayAlumno ? hsc($alumno['correo_institucional'] ?? '—') : '—';
    $alumnoCarrera = $hayAlumno ? hsc($alumno['nombre_carrera'] ?? '—') : '—';
    $alumnoGrupo   = $grupo ? hsc($grupo['nombre_grupo'] ?? '—') : '—';
    $alumnoTurno   = $grupo ? hsc($grupo['turno'] ?? '—') : '—';

    // Estado académico
    $promGen   = $estadoAc ? number_format((float)($estadoAc['promedio_general'] ?? 0), 2) : '—';
    $matCur    = $estadoAc ? hsc((string)($estadoAc['materias_cursadas'] ?? '—')) : '—';
    $matAcred  = $estadoAc ? hsc((string)($estadoAc['materias_acreditadas'] ?? '—')) : '—';
    $matRep    = $estadoAc ? hsc((string)($estadoAc['materias_reprobadas'] ?? '—')) : '—';
    $credAcum  = $estadoAc ? hsc((string)($estadoAc['creditos_acumulados'] ?? '—')) : '—';
    $pctAprob  = $estadoAc ? hsc((string)($estadoAc['porcentaje_aprobacion'] ?? '—')) : '—';

    // ──────────────────────────────────────────────
    // INDICADORES GENERALES
    // ──────────────────────────────────────────────
    $totalAl   = (int)($indic['total_alumnos'] ?? 0);
    $totalDoc  = (int)($indic['total_docentes'] ?? 0);
    $totalGr   = (int)($indic['total_grupos'] ?? 0);
    $alertTot  = (int)($indic['alertas_totales'] ?? 0);
    $alertPend = (int)($indic['alertas_pendientes'] ?? 0);
    $alertAte  = (int)($indic['alertas_atendidas'] ?? 0);
    $tasaAten  = (int)($indic['tasa_atencion'] ?? 0);

    // ──────────────────────────────────────────────
    // DISTRIBUCIÓN DE RIESGO
    // ──────────────────────────────────────────────
    $totalDist = 0;
    foreach ($dist as $d2) $totalDist += (int)($d2['total'] ?? 0);
    $criticos = 0; $altoR = 0;
    $distRows = ''; $distBars = '';
    $idxD = 0;
    foreach ($dist as $d2) {
        $nivel  = hsc($d2['nivel'] ?? '');
        $totalN = (int)($d2['total'] ?? 0);
        $pct    = $totalDist > 0 ? round(($totalN / $totalDist) * 100, 1) : 0;
        $pctBar = $totalDist > 0 ? round(($totalN / $totalDist) * 100) : 0;
        if ($nivel === 'Crítico') $criticos = $totalN;
        if ($nivel === 'Alto') $altoR = $totalN;
        $color = match ($nivel) {
            'Bajo'    => '#22c55e',
            'Medio'   => '#eab308',
            'Alto'    => '#f97316',
            'Crítico' => '#ef4444',
            default   => '#64748b',
        };
        $desc = match ($nivel) {
            'Crítico' => 'Acción inmediata',
            'Alto'    => 'Intervención prioritaria',
            'Medio'   => 'Seguimiento preventivo',
            'Bajo'    => 'Riesgo controlado',
            default   => '',
        };
        $bg = ($idxD % 2 === 0) ? '#ffffff' : '#f8fafc';
        $distRows .= '<tr style="background:' . $bg . ';">'
            . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">'
            . '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' . $color . ';margin-right:4px;vertical-align:middle;"></span>' . $nivel . '</td>'
            . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $totalN . '</td>'
            . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $pct . '%</td>'
            . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;color:' . $color . ';font-weight:700;">' . $desc . '</td>'
            . '</tr>';
        $distBars .= '<tr><td style="width:50px;font-size:7pt;font-weight:600;text-align:right;padding:1px 4px;color:' . $color . ';border:none;">' . $nivel . '</td>'
            . '<td style="border:none;padding:1px 0;"><div style="height:12px;background:#f1f5f9;border-radius:2px;overflow:hidden;">'
            . '<div style="height:100%;width:' . $pctBar . '%;background:' . $color . ';border-radius:2px;min-width:1px;"></div></div></td>'
            . '<td style="width:30px;font-size:7pt;font-weight:700;text-align:right;padding:1px 4px;border:none;">' . $totalN . '</td></tr>';
        $idxD++;
    }
    $pctAltoCritico = $totalDist > 0 ? round((($criticos + $altoR) / $totalDist) * 100, 1) : 0;

    // ──────────────────────────────────────────────
    // PARCIALES
    // ──────────────────────────────────────────────
    $parcialHtml = '';
    if (count($parciales) > 0) {
        $rowsP = '';
        $idxP = 0;
        foreach ($parciales as $p) {
            $num  = (int)($p['numero_parcial'] ?? 0);
            $prom = (float)($p['promedio_general'] ?? 0);
            $ries = (int)($p['total_riesgos'] ?? 0);
            $repr = (int)($p['total_reprobadas'] ?? 0);
            $afec = (int)($p['alumnos_afectados'] ?? 0);
            $act  = (int)($p['total_activos'] ?? 0);
            $des  = (int)($p['total_desertores'] ?? 0);
            $tasa = (int)($p['tasa_desercion'] ?? 0);
            $nivR = $tasa >= 75 ? 'Crítico' : ($tasa >= 50 ? 'Alto' : ($tasa >= 25 ? 'Medio' : 'Bajo'));
            $tCol = match ($nivR) { 'Crítico' => '#ef4444', 'Alto' => '#f97316', 'Medio' => '#eab308', default => '#22c55e' };
            $bg = ($idxP % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rowsP .= '<tr style="background:' . $bg . ';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">Parcial ' . $num . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . number_format($prom, 1) . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $ries . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $repr . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $afec . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $act . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $des . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;"><span style="background:' . $tCol . ';color:#fff;padding:1px 4px;border-radius:2px;font-weight:700;">' . $tasa . '%</span></td>'
                . '</tr>';
            $idxP++;
        }
        $parcialHtml = '<div class="st">3. Analisis por Parciales</div>'
            . '<p class="par">El analisis por parciales permite identificar tendencias tempranas de desercion. A continuacion se presentan los datos agregados del periodo <strong>' . $periodoNombre . '</strong>.</p>'
            . '<table class="dt"><thead><tr class="hdr-azul">'
            . '<th>Parcial</th><th>Promedio</th><th>Riesgos</th><th>Reprob.</th><th>Afect.</th><th>Activos</th><th>Desert.</th><th>Tasa</th>'
            . '</tr></thead><tbody>' . $rowsP . '</tbody></table>';
    }

    // ──────────────────────────────────────────────
    // CICLOS
    // ──────────────────────────────────────────────
    $ciclosHtml = '';
    if (count($ciclos) > 0) {
        $rowsC = '';
        $idxC = 0;
        foreach ($ciclos as $c) {
            $cNom  = hsc($c['ciclo'] ?? '—');
            $cAl   = (int)($c['alertas'] ?? 0);
            $cAR   = (int)($c['alto_riesgo'] ?? 0);
            $cRP   = (float)($c['riesgo_promedio'] ?? 0);
            $cTot  = (int)($c['total_alumnos'] ?? 0);
            $cTasa = (int)($c['tasa_desercion'] ?? 0);
            $cNiv  = $cTasa >= 75 ? 'Crítico' : ($cTasa >= 50 ? 'Alto' : ($cTasa >= 25 ? 'Medio' : 'Bajo'));
            $cCol  = match ($cNiv) { 'Crítico' => '#ef4444', 'Alto' => '#f97316', 'Medio' => '#eab308', default => '#22c55e' };
            $bg = ($idxC % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rowsC .= '<tr style="background:' . $bg . ';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">' . $cNom . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $cAl . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $cAR . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . number_format($cRP, 1) . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $cTot . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;"><span style="background:' . $cCol . ';color:#fff;padding:1px 4px;border-radius:2px;font-weight:700;">' . $cTasa . '%</span></td>'
                . '</tr>';
            $idxC++;
        }
        $ciclosHtml = '<div class="st">4. Comparativa por Ciclos</div>'
            . '<p class="par">El analisis comparativo historico por ciclos permite evaluar la evolucion del riesgo de desercion.</p>'
            . '<table class="dt"><thead><tr class="hdr-purpura">'
            . '<th>Ciclo</th><th>Alertas</th><th>Alto/Critico</th><th>Riesgo Prom.</th><th>Total Alumnos</th><th>Tasa</th>'
            . '</tr></thead><tbody>' . $rowsC . '</tbody></table>';
    }

    // ──────────────────────────────────────────────
    // INSIGHTS
    // ──────────────────────────────────────────────
    $insHtml = '';
    if (count($insights) > 0) {
        $iNum = 1;
        foreach ($insights as $ins) {
            $texto = hsc((string)$ins);
            $insHtml .= '<table style="width:100%;border-collapse:collapse;border:none;margin-bottom:3px;"><tr>'
                . '<td style="width:16px;vertical-align:top;border:none;padding:0;">'
                . '<div style="width:14px;height:14px;background:#4f46e5;color:#fff;border-radius:50%;text-align:center;font-size:7pt;font-weight:700;line-height:14px;">' . $iNum . '</div></td>'
                . '<td style="border:none;padding:0 0 0 4px;font-size:7.5pt;color:#334155;text-align:justify;line-height:1.45;">' . $texto . '</td>'
                . '</tr></table>';
            $iNum++;
        }
    }
    if (!$insHtml) {
        $insHtml = '<p class="par" style="color:#94a3b8;text-align:center;">No se generaron insights para el periodo actual.</p>';
    }

    // ──────────────────────────────────────────────
    // ANÁLISIS POR CARRERA
    // ──────────────────────────────────────────────
    $carreraHtml = '';
    if (count($porCarr) > 0) {
        $rowsCA = '';
        $idxCA = 0;
        foreach ($porCarr as $c) {
            $cNom  = hsc($c['carrera'] ?? '—');
            $cTot  = (int)($c['total_alertas'] ?? 0);
            $cAR   = (int)($c['alto_riesgo'] ?? 0);
            $cPend = (int)($c['pendientes'] ?? 0);
            $bg = ($idxCA % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rowsCA .= '<tr style="background:' . $bg . ';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">' . $cNom . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $cTot . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $cAR . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $cPend . '</td>'
                . '</tr>';
            $idxCA++;
        }
        $carreraHtml = '<div class="st">5. Analisis por Carrera</div>'
            . '<p class="par">El desglose por carrera permite identificar las areas con mayor incidencia de riesgo.</p>'
            . '<table class="dt"><thead><tr class="hdr-cian">'
            . '<th>Carrera</th><th>Alertas Totales</th><th>Alto/Critico</th><th>Pendientes</th>'
            . '</tr></thead><tbody>' . $rowsCA . '</tbody></table>';
    }

    // ──────────────────────────────────────────────
    // PROGRESIÓN TEMPORAL
    // ──────────────────────────────────────────────
    $progHtml = '';
    if (count($progres) > 0) {
        $rowsPR = '';
        $idxPR = 0;
        foreach ($progres as $p) {
            $mes = hsc($p['mes'] ?? '—');
            $b   = (int)($p['bajo'] ?? 0);
            $m   = (int)($p['medio'] ?? 0);
            $a   = (int)($p['alto'] ?? 0);
            $cr  = (int)($p['critico'] ?? 0);
            $t   = (int)($p['total'] ?? 0);
            $bg  = ($idxPR % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rowsPR .= '<tr style="background:' . $bg . ';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $mes . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $b . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $m . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $a . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $cr . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;font-weight:700;">' . $t . '</td>'
                . '</tr>';
            $idxPR++;
        }
        $progHtml = '<div class="st">6. Progresion Temporal del Riesgo</div>'
            . '<p class="par">Evolucion mensual de las alertas de desercion en el periodo analizado.</p>'
            . '<table class="dt"><thead><tr class="hdr-purpura">'
            . '<th>Mes</th><th style="color:#22c55e;">Bajo</th><th style="color:#eab308;">Medio</th><th style="color:#f97316;">Alto</th><th style="color:#ef4444;">Critico</th><th>Total</th>'
            . '</tr></thead><tbody>' . $rowsPR . '</tbody></table>';
    }

    // ──────────────────────────────────────────────
    // MATERIAS CRÍTICAS
    // ──────────────────────────────────────────────
    $matHtml = '';
    if (count($porMat) > 0) {
        $rowsMT = '';
        $idxMT = 0;
        foreach ($porMat as $m) {
            $mNom  = hsc($m['materia'] ?? '—');
            $mEval = (int)($m['alumnos_evaluados'] ?? 0);
            $mProm = (float)($m['promedio'] ?? 0);
            $mRep  = (int)($m['reprobados'] ?? 0);
            $mNiv  = hsc($m['nivel'] ?? 'Estable');
            $mCol  = match ($mNiv) { 'Crítico' => '#ef4444', 'Atención' => '#f97316', default => '#22c55e' };
            $bg = ($idxMT % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rowsMT .= '<tr style="background:' . $bg . ';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">' . $mNom . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $mEval . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . number_format($mProm, 1) . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $mRep . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;"><span style="background:' . $mCol . ';color:#fff;padding:1px 4px;border-radius:2px;font-weight:700;font-size:6.5pt;">' . $mNiv . '</span></td>'
                . '</tr>';
            $idxMT++;
        }
        $matHtml = '<div class="st">7. Materias Criticas</div>'
            . '<p class="par">Las materias con indicadores mas desfavorables en promedio y reprobacion.</p>'
            . '<table class="dt"><thead><tr class="hdr-rojo">'
            . '<th>Materia</th><th>Alumnos Eval.</th><th>Promedio</th><th>Reprobados</th><th>Nivel</th>'
            . '</tr></thead><tbody>' . $rowsMT . '</tbody></table>';
    }

    // ──────────────────────────────────────────────
    // ALERTAS RECIENTES
    // ──────────────────────────────────────────────
    $alertHtml = '';
    if (count($alertas) > 0) {
        $rowsAL = '';
        $idxAL = 0;
        foreach ($alertas as $a) {
            $aNum   = $idxAL + 1;
            $aMat   = hsc($a['matricula'] ?? '');
            $aNom   = hsc($a['nombre_completo'] ?? trim(($a['nombres'] ?? '') . ' ' . ($a['apellido_paterno'] ?? '') . ' ' . ($a['apellido_materno'] ?? '')));
            $aRies  = hsc($a['nivel_riesgo'] ?? '');
            $aPunt  = (int)($a['puntaje_riesgo'] ?? 0);
            $aEstado = !empty($a['atendida']) ? 'Atendida' : 'Pendiente';
            $aPer   = hsc($a['nombre_periodo'] ?? '');
            $aRCol  = match ($aRies) { 'Crítico' => '#ef4444', 'Alto' => '#f97316', 'Medio' => '#eab308', 'Bajo' => '#22c55e', default => '#64748b' };
            $aECol  = $aEstado === 'Atendida' ? '#16a34a' : '#f97316';
            $bg = ($idxAL % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rowsAL .= '<tr style="background:' . $bg . ';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $aNum . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">' . $aMat . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">' . $aNom . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;"><span style="background:' . $aRCol . ';color:#fff;padding:1px 4px;border-radius:2px;font-weight:700;font-size:6.5pt;">' . $aRies . '</span></td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $aPunt . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;"><span style="background:' . $aECol . ';color:#fff;padding:1px 4px;border-radius:2px;font-size:6.5pt;">' . $aEstado . '</span></td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">' . $aPer . '</td>'
                . '</tr>';
            $idxAL++;
        }
        $alertHtml = '<div class="st">8. Alertas Recientes</div>'
            . '<p class="par">Alertas de desercion mas recientes registradas en el sistema.</p>'
            . '<table class="dt"><thead><tr class="hdr-indigo">'
            . '<th>#</th><th>Matricula</th><th>Alumno</th><th>Riesgo</th><th>Puntaje</th><th>Estado</th><th>Periodo</th>'
            . '</tr></thead><tbody>' . $rowsAL . '</tbody></table>';
    }

    // ──────────────────────────────────────────────
    // OBSERVACIONES
    // ──────────────────────────────────────────────
    $obsHtml = '';
    if (count($observ) > 0) {
        $rowsOB = '';
        foreach ($observ as $o) {
            $oAcc = hsc($o['accion'] ?? '');
            $oObs = hsc($o['observaciones'] ?? '');
            $oEst = hsc($o['estado'] ?? '');
            $oUsr = hsc($o['usuario_nombre'] ?? '');
            $rowsOB .= '<tr>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">' . $oAcc . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">' . $oObs . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $oEst . '</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">' . $oUsr . '</td>'
                . '</tr>';
        }
        if ($rowsOB) {
            $obsHtml = '<div class="st">9. Observaciones y Seguimiento</div>'
                . '<table class="dt"><thead><tr class="hdr-verde">'
                . '<th>Accion</th><th>Observaciones</th><th>Estado</th><th>Responsable</th>'
                . '</tr></thead><tbody>' . $rowsOB . '</tbody></table>';
        }
    }

    // ──────────────────────────────────────────────
    // RECOMENDACIONES
    // ──────────────────────────────────────────────
    $recomHtml = '';
    if (count($recom) > 0) {
        $recomHtml .= '<div class="st">10. Recomendaciones</div>';
        $rc = 1;
        foreach ($recom as $r) {
            if (!is_string($r) || trim($r) === '') continue;
            $rTxt = hsc($r);
            $recomHtml .= '<table style="width:100%;border-collapse:collapse;border:none;margin-bottom:3px;"><tr>'
                . '<td style="width:16px;vertical-align:top;border:none;padding:0;">'
                . '<div style="width:14px;height:14px;background:#059669;color:#fff;border-radius:50%;text-align:center;font-size:7pt;font-weight:700;line-height:14px;">' . $rc . '</div></td>'
                . '<td style="border:none;padding:0 0 0 4px;font-size:7.5pt;color:#334155;text-align:justify;line-height:1.45;">' . $rTxt . '</td>'
                . '</tr></table>';
            $rc++;
        }
    }

    // ──────────────────────────────────────────────
    // SELLOS
    // ──────────────────────────────────────────────
    if (count($sellos) === 0) {
        $sellos = [
            ['titulo' => 'Sello SIVACAD', 'descripcion' => 'Sello oficial del Sistema Integral para la Valoracion del Conocimiento y Aprovechamiento Academico'],
            ['titulo' => 'Sello Division ISC', 'descripcion' => 'Sello de la Division de Ingenieria en Sistemas Computacionales'],
            ['titulo' => 'Sello Control Escolar', 'descripcion' => 'Sello oficial de Control Escolar'],
        ];
    }
    $sello1 = ''; $sello2 = ''; $sello3 = '';
    $sIdx = 0;
    foreach (array_slice($sellos, 0, 3) as $s) {
        $sTit = hsc($s['titulo'] ?? '');
        $sDes = hsc($s['descripcion'] ?? '');
        $sb = '<div style="border-top:1px solid #000;padding-top:5px;margin:0 10px;">'
            . '<div style="font-size:7pt;font-weight:700;color:#0f172a;">' . $sTit . '</div>'
            . '<div style="font-size:5.5pt;color:#64748b;margin-top:2px;">' . $sDes . '</div>'
            . '</div>';
        if ($sIdx === 0) $sello1 = $sb;
        elseif ($sIdx === 1) $sello2 = $sb;
        else $sello3 = $sb;
        $sIdx++;
    }

    // ──────────────────────────────────────────────
    // FOTO
    // ──────────────────────────────────────────────
    if ($fotoUrl) {
        $fotoHtml = '<img src="' . $fotoUrl . '" style="width:100%;height:100%;object-fit:cover;" alt="Foto">';
    } else {
        $fotoHtml = '<span style="color:#94a3b8;fontSize:5pt;">Foto institucional</span>';
    }

    // ──────────────────────────────────────────────
    // MOTIVO DE ALERTA
    // ──────────────────────────────────────────────
    $motivoHtml = '';
    if ($motivo && $hayAlumno) {
        $motivoHtml = '<tr><td style="font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;width:120px;">Motivo Alerta:</td>'
            . '<td style="color:#dc2626;padding:1px 0;font-style:italic;">' . hsc($motivo) . '</td></tr>';
    }

    // ──────────────────────────────────────────────
    // INDICADORES HEADER COLOR
    // ──────────────────────────────────────────────
    $alertColor = $tasaAten >= 50 ? '#16a34a' : '#dc2626';

    // ══════════════════════════════════════════════
    // HTML OUTPUT
    // ══════════════════════════════════════════════
    return '<!DOCTYPE html>'
    . '<html lang="es-MX"><head><meta charset="UTF-8"><style>'
    . '@page { margin: 0.5cm 0.7cm 1.5cm 0.7cm; size: letter; }'
    . '* { margin: 0; padding: 0; box-sizing: border-box; }'
    . 'body { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #0f172a; line-height: 1.35; }'
    . '.watermark { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-size: 100% 100%; background-position: center; background-repeat: no-repeat; opacity: 0.06; z-index: -1; pointer-events: none; ' . $wmStyle . ' }'
    . '.st { font-size: 10pt; font-weight: 700; color: #0f172a; border-bottom: 2px solid #4f46e5; padding-bottom: 2px; margin: 10px 0 6px 0; text-transform: uppercase; letter-spacing: 0.3px; }'
    . '.par { font-size: 7.5pt; color: #334155; text-align: justify; line-height: 1.5; margin-bottom: 5px; }'
    . '.fixed-bottom { position: fixed; bottom: 0; left: 0; right: 0; z-index: 10; background: #ffffff; }'
    . '.dt { width: 100%; border-collapse: collapse; margin-top: 3px; }'
    . '.dt th { color: #ffffff; padding: 3px 4px; font-weight: 600; text-align: center; font-size: 6.5pt; border: 1px solid; }'
    . '.dt td { }'
    . '.hdr-azul th { background: #3b82f6; border-color: #3b82f6; }'
    . '.hdr-purpura th { background: #8b5cf6; border-color: #8b5cf6; }'
    . '.hdr-cian th { background: #0ea5e9; border-color: #0ea5e9; }'
    . '.hdr-rojo th { background: #dc2626; border-color: #dc2626; }'
    . '.hdr-indigo th { background: #4f46e5; border-color: #4f46e5; }'
    . '.hdr-verde th { background: #059669; border-color: #059669; }'
    . 'td, th { vertical-align: middle; }'
    . 'table { page-break-inside: avoid; }'
    . '</style></head><body>'

    . '<div class="watermark"></div>'

    // ══════════════════════════════════════════════
    // ENCABEZADO SUPERIOR
    // ══════════════════════════════════════════════

    // LOGOS
    . '<table style="width:100%;border-collapse:collapse;border:none;"><tr>'
    . '<td style="width:33%;text-align:left;vertical-align:middle;border:none;padding:0;"><img src="' . $logo_tecnm . '" style="height:48px;" alt="TecNM"></td>'
    . '<td style="width:34%;text-align:center;vertical-align:middle;border:none;padding:0;"><img src="' . $logo_sivacad . '" style="height:48px;" alt="SIVACAD"></td>'
    . '<td style="width:33%;text-align:right;vertical-align:middle;border:none;padding:0;"><img src="' . $logo_tesi . '" style="height:48px;" alt="TESI"></td>'
    . '</tr></table>'

    // TITULO PRINCIPAL
    . '<table style="width:100%;border-collapse:collapse;border:none;margin-top:1px;"><tr>'
    . '<td style="text-align:center;font-size:12pt;font-weight:700;color:#0f172a;padding:2px 0;">REPORTE ESTRATEGICO DE RIESGO DE DESERCION</td></tr>'
    . '<tr><td style="text-align:center;font-size:6.5pt;font-weight:600;color:#4f46e5;text-transform:uppercase;letter-spacing:0.5px;padding:1px 0;">' . $sistema . '</td></tr>'
    . '</table>'

    // METADATOS
    . '<table style="width:100%;border-collapse:collapse;border:none;margin-top:1px;"><tr>'
    . '<td style="text-align:center;font-size:6pt;color:#475569;border-bottom:1px solid #cbd5e1;padding:2px 0 3px 0;">'
    . 'Folio: <strong>' . $folio . '</strong> &nbsp;|&nbsp; Periodo: <strong>' . $periodoNombre . '</strong> &nbsp;|&nbsp; '
    . 'Generado: <strong>' . $fecha . '</strong> &nbsp;|&nbsp; Zona: <strong>' . $zona . '</strong>'
    . '</td></tr></table>'

    // ══════════════════════════════════════════════
    // DATOS DEL ALUMNO (SOLO SI HAY ALUMNO)
    // ══════════════════════════════════════════════
    . ($hayAlumno ? '
    <table style="width:100%;border-collapse:collapse;border:none;margin-top:3px;"><tr>'
    . '<td style="font-size:8.5pt;font-weight:700;color:#1e40af;border-bottom:1.5px solid #1e40af;padding-bottom:2px;text-transform:uppercase;">DATOS DEL ALUMNO</td>'
    . '</tr></table>

    <table style="width:100%;border-collapse:collapse;border:none;margin-top:3px;"><tr>'
    // COLUMNA IZQUIERDA
    . '<td style="width:65%;vertical-align:top;border:none;padding-right:10px;">'
    . '<table style="width:100%;border-collapse:collapse;border:none;font-size:7.5pt;">'
    . '<tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Nombre Completo:</td><td style="color:#334155;padding:1px 0;">' . $alumnoNombre . '</td></tr>'
    . '<tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Matricula:</td><td style="color:#334155;padding:1px 0;">' . $alumnoMat . '</td></tr>'
    . '<tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">CURP:</td><td style="color:#334155;padding:1px 0;">' . $alumnoCURP . '</td></tr>'
    . '<tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Carrera:</td><td style="color:#334155;padding:1px 0;">' . $alumnoCarrera . '</td></tr>'
    . '<tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Semestre:</td><td style="color:#334155;padding:1px 0;">' . $alumnoSem . '</td></tr>'
    . '<tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Grupo:</td><td style="color:#334155;padding:1px 0;">' . $alumnoGrupo . '</td></tr>'
    . '<tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Turno:</td><td style="color:#334155;padding:1px 0;">' . $alumnoTurno . '</td></tr>'
    . '<tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Estatus Academico:</td><td style="color:#334155;padding:1px 0;">' . $alumnoEstatus . '</td></tr>'
    . '<tr><td style="width:120px;font-weight:700;color:#0f172a;padding:1px 0;vertical-align:top;">Correo:</td><td style="color:#334155;padding:1px 0;">' . $alumnoCorreo . '</td></tr>'
    . $motivoHtml
    . '</table>'
    . '</td>'
    // COLUMNA DERECHA — FOTO
    . '<td style="width:35%;vertical-align:top;text-align:right;border:none;">'
    . '<table style="border-collapse:collapse;margin-left:auto;">'
    . '<tr><td style="width:5cm;height:2.5cm;border:1.5px solid #cbd5e1;text-align:center;vertical-align:middle;background:#f8fafc;">'
    . $fotoHtml
    . '</td></tr></table>'
    . '</td>'
    . '</tr></table>'
    : '')

    // ══════════════════════════════════════════════
    // ESTADO ACADÉMICO (SOLO SI HAY ALUMNO)
    // ══════════════════════════════════════════════
    . ($hayAlumno && $estadoAc ? '
    <table style="width:100%;border-collapse:collapse;border:none;margin-top:5px;"><tr>'
    . '<td style="font-size:8.5pt;font-weight:700;color:#1e40af;border-bottom:1.5px solid #1e40af;padding-bottom:2px;text-transform:uppercase;">ESTADO ACADEMICO</td>'
    . '</tr></table>
    <table style="width:100%;border-collapse:collapse;margin-top:2px;">
    <thead><tr style="background:#1e40af;">
    <th style="color:#fff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Promedio General</th>
    <th style="color:#fff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Materias Cursadas</th>
    <th style="color:#fff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Acreditadas</th>
    <th style="color:#fff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Reprobadas</th>
    <th style="color:#fff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">Creditos Acum.</th>
    <th style="color:#fff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #1e40af;">% Aprobacion</th>
    </tr></thead><tbody>
    <tr><td style="padding:3px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;font-weight:700;">' . $promGen . '</td>'
    . '<td style="padding:3px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $matCur . '</td>'
    . '<td style="padding:3px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $matAcred . '</td>'
    . '<td style="padding:3px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $matRep . '</td>'
    . '<td style="padding:3px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $credAcum . '</td>'
    . '<td style="padding:3px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">' . $pctAprob . '%</td>'
    . '</tr></tbody></table>'
    : '')

    // ══════════════════════════════════════════════
    // 1. RESUMEN EJECUTIVO
    // ══════════════════════════════════════════════
    . '<div class="st">1. Resumen Ejecutivo</div>'
    . '<p class="par">El presente reporte consolida el analisis de riesgo de desercion academico del periodo <strong>' . $periodoNombre . '</strong>. '
    . 'Se han generado <strong>' . $alertTot . '</strong> alertas de desercion, de las cuales <strong style="color:#f97316;">' . $alertPend . '</strong> estan pendientes de atencion y <strong style="color:#16a34a;">' . $alertAte . '</strong> han sido atendidas, representando una tasa de atencion del <strong style="color:' . $alertColor . ';">' . $tasaAten . '%</strong>.</p>'

    // KPI CARDS
    . '<table style="width:100%;border-collapse:collapse;border:none;margin-top:4px;"><tr>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Alertas Totales</div><div style="font-size:13pt;font-weight:700;color:#4f46e5;">' . $alertTot . '</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Pendientes</div><div style="font-size:13pt;font-weight:700;color:#f97316;">' . $alertPend . '</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Atendidas</div><div style="font-size:13pt;font-weight:700;color:#16a34a;">' . $alertAte . '</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Tasa Atencion</div><div style="font-size:13pt;font-weight:700;color:' . $alertColor . ';">' . $tasaAten . '%</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Alumnos</div><div style="font-size:13pt;font-weight:700;color:#3b82f6;">' . $totalAl . '</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Grupos</div><div style="font-size:13pt;font-weight:700;color:#8b5cf6;">' . $totalGr . '</div></td>'
    . '</tr></table>'

    // ══════════════════════════════════════════════
    // 2. DISTRIBUCIÓN DE RIESGO
    // ══════════════════════════════════════════════
    . '<div class="st">2. Distribucion de Riesgo Academico</div>'
    . '<p class="par">De los <strong>' . $totalDist . '</strong> casos analizados, el <strong>' . $pctAltoCritico . '%</strong> se concentra en niveles Alto o Critico, lo que representa una señal de alerta institucional.</p>'
    . '<table class="dt"><thead><tr style="background:#4f46e5;">'
    . '<th style="color:#fff;padding:3px 4px;font-weight:600;text-align:left;font-size:6.5pt;border:1px solid #4f46e5;">Nivel</th>'
    . '<th style="color:#fff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">Total</th>'
    . '<th style="color:#fff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">Porcentaje</th>'
    . '<th style="color:#fff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">Descripcion</th>'
    . '</tr></thead><tbody>' . $distRows . '</tbody></table>'
    . '<table style="width:100%;border-collapse:collapse;border:none;margin-top:4px;"><tr><td style="border:none;padding:0;">'
    . '<table style="width:100%;border-collapse:collapse;border:none;">' . $distBars . '</table>'
    . '</td></tr></table>'

    // ══════════════════════════════════════════════
    // BLOQUES CONDICIONALES
    // ══════════════════════════════════════════════
    . $parcialHtml
    . $ciclosHtml
    . '<div class="st">' . ($hayAlumno ? '2' : '3') . '. Insights Estrategicos</div>'
    . '<p class="par">Hallazgos clave del analisis automatizado de desercion generados por el modelo de inteligencia artificial de SIVACAD.</p>'
    . $insHtml
    . $carreraHtml
    . $progHtml
    . $alertHtml
    . $matHtml
    . $obsHtml
    . $recomHtml

    // ══════════════════════════════════════════════
    // PIE DE PÁGINA — SELLOS
    // ══════════════════════════════════════════════
    . '<div style="height:40px;"></div>'
    . '<div class="fixed-bottom">'
    . '<table style="width:100%;border-collapse:collapse;border:none;"><tr>'
    . '<td style="width:33.3%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">' . $sello1 . '</td>'
    . '<td style="width:33.3%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">' . $sello2 . '</td>'
    . '<td style="width:33.3%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">' . $sello3 . '</td>'
    . '</tr></table>'
    . '<table style="width:100%;border-collapse:collapse;border:none;"><tr>'
    . '<td style="text-align:center;font-size:5pt;color:#94a3b8;border-top:1px solid #cbd5e1;padding:2px 0;">'
    . '<strong>SIVACAD</strong> &mdash; ' . $sistema . ' &nbsp;|&nbsp; '
    . 'Generado: ' . $fecha . ' &nbsp;|&nbsp; Folio: ' . $folio . ' &nbsp;|&nbsp; Periodo: ' . $periodoNombre . ' &nbsp;|&nbsp; '
    . '<strong>CONFIDENCIAL</strong> &mdash; Uso Academico Exclusivo'
    . '</td></tr></table>'
    . '</div>'

    . '</body></html>';
}

/**
 * Helper: htmlspecialchars wrapper.
 */
if (!function_exists('hsc')) {
    function hsc(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
}
