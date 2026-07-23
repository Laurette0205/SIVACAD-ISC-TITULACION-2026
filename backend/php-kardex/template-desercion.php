<?php
/**
 * SIVACAD-ISC — Copyright (c) 2026 Bárcenas González Laura Casandra &
 *                    Morales Ibarra Sandivel — TESI — ISC
 *
/**
 * template-desercion.php
 *
 * Plantilla HTML para el Reporte Estratégico de Deserción Académica.
 * Compatible con Dompdf. Sigue el mismo patrón que template-kardex.php.
 */

function getDesercionTemplate(array $data): string
{
    $periodo    = htmlspecialchars($data['periodo_activo'] ?? 'N/D', ENT_QUOTES, 'UTF-8');
    $fecha      = htmlspecialchars($data['fecha_emision'] ?? date('d/m/Y H:i:s'), ENT_QUOTES, 'UTF-8');
    $generadoPor = htmlspecialchars($data['generado_por'] ?? 'Sistema SIVACAD', ENT_QUOTES, 'UTF-8');
    $folio      = htmlspecialchars($data['folio'] ?? 'D-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3))), ENT_QUOTES, 'UTF-8');

    $r = $data['resumen'] ?? [];
    $alumnos   = (int)($r['alumnos'] ?? 0);
    $docentes  = (int)($r['docentes'] ?? 0);
    $grupos    = (int)($r['grupos'] ?? 0);
    $totalAl   = (int)($r['alertas_total'] ?? 0);
    $pendientes = (int)($r['alertas_pendientes'] ?? 0);
    $atendidas  = (int)($r['alertas_atendidas'] ?? 0);
    $tasaAt    = (int)($r['tasa_atencion'] ?? 0);

    $dist = $data['distribucion_riesgo'] ?? [];
    $totalDist = 0;
    foreach ($dist as $d) $totalDist += (int)($d['total'] ?? 0);
    $criticos = 0; $alto = 0;
    $distRowsHtml = '';
    $distBarHtml = '';
    $distIdx = 0;
    foreach ($dist as $d) {
        $nivel = htmlspecialchars($d['nivel'] ?? '', ENT_QUOTES, 'UTF-8');
        $total = (int)($d['total'] ?? 0);
        $pct = $totalDist > 0 ? round(($total / $totalDist) * 100, 1) : 0;
        $pctBar = $totalDist > 0 ? round(($total / $totalDist) * 100) : 0;
        $color = match ($nivel) { 'Bajo' => '#22c55e', 'Medio' => '#eab308', 'Alto' => '#f97316', 'Crítico' => '#ef4444', default => '#64748b' };
        $desc = match ($nivel) { 'Crítico' => 'Acción inmediata requerida', 'Alto' => 'Intervención prioritaria', 'Medio' => 'Seguimiento preventivo', 'Bajo' => 'Riesgo controlado', default => '' };
        if ($nivel === 'Crítico') $criticos = $total;
        if ($nivel === 'Alto') $alto = $total;
        $bg = ($distIdx % 2 === 0) ? '#ffffff' : '#f8fafc';
        $distRowsHtml .= '<tr style="background-color:'.$bg.';">'
            . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:left;">'
            . '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'.$color.';margin-right:4px;vertical-align:middle;"></span>'.$nivel.'</td>'
            . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$total.'</td>'
            . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$pct.'%</td>'
            . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;color:'.$color.';font-weight:700;">'.$desc.'</td>'
            . '</tr>';
        $distBarHtml .= '<tr>'
            . '<td style="width:50px;font-size:7pt;font-weight:600;text-align:right;padding:1px 4px;color:'.$color.';border:none;">'.$nivel.'</td>'
            . '<td style="border:none;padding:1px 0;"><div style="height:12px;background:#f1f5f9;border-radius:2px;overflow:hidden;">'
            . '<div style="height:100%;width:'.$pctBar.'%;background:'.$color.';border-radius:2px;min-width:1px;"></div></div></td>'
            . '<td style="width:30px;font-size:7pt;font-weight:700;text-align:right;padding:1px 4px;border:none;">'.$total.'</td>'
            . '</tr>';
        $distIdx++;
    }

    $parciales = $data['parciales'] ?? [];
    $parcialSection = '';
    if (count($parciales) > 0) {
        $rows = '';
        $pIdx = 0;
        foreach ($parciales as $p) {
            $num = (int)($p['numero'] ?? $p['numero_parcial'] ?? 0);
            $prom = (float)($p['promedio_general'] ?? 0);
            $riesgos = (int)($p['total_riesgos'] ?? 0);
            $reprob = (int)($p['total_reprobadas'] ?? 0);
            $afect = (int)($p['alumnos_afectados'] ?? 0);
            $activos = (int)($p['total_activos'] ?? 0);
            $desert  = (int)($p['total_desertores'] ?? 0);
            $tasaP = (int)($p['tasa_desercion'] ?? 0);
            $nivelR = $tasaP >= 75 ? 'Crítico' : ($tasaP >= 50 ? 'Alto' : ($tasaP >= 25 ? 'Medio' : 'Bajo'));
            $tColor = match ($nivelR) { 'Crítico' => '#ef4444', 'Alto' => '#f97316', 'Medio' => '#eab308', default => '#22c55e' };
            $bg = ($pIdx % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rows .= '<tr style="background-color:'.$bg.';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">Parcial '.$num.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$prom.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$riesgos.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$reprob.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$afect.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$activos.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$desert.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'
                . '<span style="background:'.$tColor.';color:#ffffff;padding:1px 4px;border-radius:2px;font-weight:700;">'.$tasaP.'%</span></td>'
                . '</tr>';
            $pIdx++;
        }
        $parcialSection = '<div class="section-title">3. An\u00e1lisis por Parciales Acad\u00e9micos</div>'
            . '<p class="paragraph">El an\u00e1lisis por parciales acad\u00e9micos permite identificar tendencias tempranas de deserci\u00f3n y evaluar el impacto de las intervenciones pedag\u00f3gicas implementadas durante el ciclo escolar <strong>'.$periodo.'</strong>.</p>'
            . '<table style="width:100%;border-collapse:collapse;margin-top:3px;"><thead><tr style="background-color:#3b82f6;">'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #3b82f6;">Parcial</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #3b82f6;">Promedio</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #3b82f6;">Riesgos</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #3b82f6;">Reprob.</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #3b82f6;">Afect.</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #3b82f6;">Activos</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #3b82f6;">Desert.</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #3b82f6;">Tasa</th>'
            . '</tr></thead><tbody>'.$rows.'</tbody></table>';
    }

    $ciclos = $data['ciclos'] ?? [];
    $ciclosSection = '';
    if (count($ciclos) > 1) {
        $rows = '';
        $cIdx = 0;
        foreach ($ciclos as $c) {
            $cName = htmlspecialchars($c['ciclo'] ?? '—', ENT_QUOTES, 'UTF-8');
            $cAl = (int)($c['alertas'] ?? 0);
            $cAlto = (int)($c['alto_riesgo'] ?? 0);
            $cRiesgo = (float)($c['riesgo_promedio'] ?? 0);
            $cTotAl = (int)($c['total_alumnos'] ?? 0);
            $cTasa = (int)($c['tasa_desercion'] ?? 0);
            $cNivel = $cTasa >= 75 ? 'Crítico' : ($cTasa >= 50 ? 'Alto' : ($cTasa >= 25 ? 'Medio' : 'Bajo'));
            $cColor = match ($cNivel) { 'Crítico' => '#ef4444', 'Alto' => '#f97316', 'Medio' => '#eab308', default => '#22c55e' };
            $bg = ($cIdx % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rows .= '<tr style="background-color:'.$bg.';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:left;">'.$cName.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$cAl.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$cAlto.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$cRiesgo.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$cTotAl.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'
                . '<span style="background:'.$cColor.';color:#ffffff;padding:1px 4px;border-radius:2px;font-weight:700;">'.$cTasa.'%</span></td>'
                . '</tr>';
            $cIdx++;
        }
        $ciclosSection = '<div class="section-title">4. Comparativa por Ciclos Escolares</div>'
            . '<p class="paragraph">El an\u00e1lisis comparativo hist\u00f3rico por ciclos escolares permite a la Direcci\u00f3n Acad\u00e9mica evaluar la evoluci\u00f3n de la deserci\u00f3n estudiantil a lo largo del tiempo.</p>'
            . '<table style="width:100%;border-collapse:collapse;margin-top:3px;"><thead><tr style="background-color:#8b5cf6;">'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:left;font-size:6.5pt;border:1px solid #8b5cf6;">Ciclo</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Alertas</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Alto/Cr\u00edtico</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Riesgo Prom.</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Total Alumnos</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Tasa Deser.</th>'
            . '</tr></thead><tbody>'.$rows.'</tbody></table>';
    }

    $insights = $data['insights'] ?? [];
    $insightsHtml = '';
    $iNum = 1;
    foreach ($insights as $ins) {
        $texto = htmlspecialchars((string)$ins, ENT_QUOTES, 'UTF-8');
        $insightsHtml .= '<table style="width:100%;border-collapse:collapse;border:none;margin-bottom:3px;"><tr>'
            . '<td style="width:16px;vertical-align:top;border:none;padding:0;">'
            . '<div style="width:14px;height:14px;background:#4f46e5;color:#ffffff;border-radius:50%;text-align:center;font-size:7pt;font-weight:700;line-height:14px;">'+$iNum+'</div></td>'
            . '<td style="border:none;padding:0 0 0 4px;font-size:7.5pt;color:#334155;text-align:justify;line-height:1.45;">'+$texto+'</td>'
            . '</tr></table>';
        $iNum++;
    }
    $insightsHtml = $insightsHtml ?: '<p class="paragraph" style="color:#94a3b8;text-align:center;">No se generaron insights para el per\u00edodo actual.</p>';

    $porCarrera = $data['por_carrera'] ?? [];
    $carreraSection = '';
    if (count($porCarrera) > 0) {
        $rows = '';
        $caIdx = 0;
        foreach ($porCarrera as $c) {
            $cName = htmlspecialchars($c['carrera'] ?? '—', ENT_QUOTES, 'UTF-8');
            $cTot = (int)($c['total_alertas'] ?? 0);
            $cAlto = (int)($c['alto_riesgo'] ?? 0);
            $cPend = (int)($c['pendientes'] ?? 0);
            $bg = ($caIdx % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rows .= '<tr style="background-color:'.$bg.';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">'.$cName.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$cTot.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$cAlto.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$cPend.'</td>'
                . '</tr>';
            $caIdx++;
        }
        $pCarrera = htmlspecialchars($porCarrera[0]['carrera'] ?? '—', ENT_QUOTES, 'UTF-8');
        $pTot = (int)($porCarrera[0]['total_alertas'] ?? 0);
        $carreraSection = '<div class="section-title">6. An\u00e1lisis por Carrera</div>'
            . '<p class="paragraph">El desglose por carrera permite identificar las \u00e1reas acad\u00e9micas con mayor incidencia de riesgo de deserci\u00f3n. La carrera de <strong>'.$pCarrera.'</strong> encabeza la lista con <strong>'.$pTot.'</strong> alertas.</p>'
            . '<table style="width:100%;border-collapse:collapse;margin-top:3px;"><thead><tr style="background-color:#0ea5e9;">'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:left;font-size:6.5pt;border:1px solid #0ea5e9;">Carrera</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #0ea5e9;">Alertas Totales</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #0ea5e9;">Alto/Cr\u00edtico</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #0ea5e9;">Pendientes</th>'
            . '</tr></thead><tbody>'.$rows.'</tbody></table>';
    }

    $progresion = $data['progresion'] ?? [];
    $progSection = '';
    if (count($progresion) > 0) {
        $rows = '';
        $prIdx = 0;
        foreach ($progresion as $p) {
            $mes = htmlspecialchars($p['mes'] ?? '—', ENT_QUOTES, 'UTF-8');
            $b = (int)($p['bajo'] ?? 0);
            $m = (int)($p['medio'] ?? 0);
            $a = (int)($p['alto'] ?? 0);
            $cr = (int)($p['critico'] ?? 0);
            $t = (int)($p['total'] ?? 0);
            $bg = ($prIdx % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rows .= '<tr style="background-color:'.$bg.';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$mes.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$b.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$m.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$a.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$cr.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;font-weight:700;">'.$t.'</td>'
                . '</tr>';
            $prIdx++;
        }
        $progSection = '<div class="section-title">7. Progresi\u00f3n Temporal del Riesgo</div>'
            . '<p class="paragraph">La evoluci\u00f3n mensual de las alertas de deserci\u00f3n muestra la din\u00e1mica del riesgo a lo largo del per\u00edodo analizado.</p>'
            . '<table style="width:100%;border-collapse:collapse;margin-top:3px;"><thead><tr style="background-color:#8b5cf6;">'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Mes</th>'
            . '<th style="color:#22c55e;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Bajo</th>'
            . '<th style="color:#eab308;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Medio</th>'
            . '<th style="color:#f97316;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Alto</th>'
            . '<th style="color:#ef4444;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Cr\u00edtico</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #8b5cf6;">Total</th>'
            . '</tr></thead><tbody>'.$rows.'</tbody></table>';
    }

    $porMateria = $data['por_materia'] ?? [];
    $materiaSection = '';
    if (count($porMateria) > 0) {
        $rows = '';
        $mIdx = 0;
        foreach ($porMateria as $m) {
            $mName = htmlspecialchars($m['materia'] ?? '—', ENT_QUOTES, 'UTF-8');
            $mEval = (int)($m['alumnos_evaluados'] ?? 0);
            $mProm = (float)($m['promedio'] ?? 0);
            $mRep = (int)($m['reprobados'] ?? 0);
            $mNivel = htmlspecialchars($m['nivel'] ?? 'Estable', ENT_QUOTES, 'UTF-8');
            $mColor = match ($mNivel) { 'Cr\u00edtico' => '#ef4444', 'Atenci\u00f3n' => '#f97316', default => '#22c55e' };
            $bg = ($mIdx % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rows .= '<tr style="background-color:'.$bg.';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">'.$mName.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$mEval.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$mProm.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$mRep.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'
                . '<span style="background:'.$mColor.';color:#ffffff;padding:1px 4px;border-radius:2px;font-weight:700;font-size:6.5pt;">'.$mNivel.'</span></td>'
                . '</tr>';
            $mIdx++;
        }
        $materiaSection = '<div class="section-title">9. Materias Cr\u00edticas</div>'
            . '<p class="paragraph">Las siguientes materias presentan los indicadores m\u00e1s desfavorables en cuanto a promedio general y n\u00famero de reprobados.</p>'
            . '<table style="width:100%;border-collapse:collapse;margin-top:3px;"><thead><tr style="background-color:#dc2626;">'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:left;font-size:6.5pt;border:1px solid #dc2626;">Materia</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #dc2626;">Alumnos Eval.</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #dc2626;">Promedio</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #dc2626;">Reprobados</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #dc2626;">Nivel</th>'
            . '</tr></thead><tbody>'.$rows.'</tbody></table>';
    }

    $alertas = $data['alertas_recientes'] ?? [];
    $alertasSection = '';
    if (count($alertas) > 0) {
        $rows = '';
        $aIdx = 0;
        foreach ($alertas as $a) {
            $aNum = $aIdx + 1;
            $aMat = htmlspecialchars($a['matricula'] ?? '', ENT_QUOTES, 'UTF-8');
            $aNom = htmlspecialchars(trim(($a['nombres'] ?? '').' '.($a['apellido_paterno'] ?? '').' '.($a['apellido_materno'] ?? '')), ENT_QUOTES, 'UTF-8');
            $aRiesgo = htmlspecialchars($a['nivel_riesgo'] ?? '', ENT_QUOTES, 'UTF-8');
            $aPunt = (int)($a['puntaje_riesgo'] ?? 0);
            $aEstado = !empty($a['atendida']) ? 'Atendida' : 'Pendiente';
            $aPeriodo = htmlspecialchars($a['nombre_periodo'] ?? '', ENT_QUOTES, 'UTF-8');
            $aRColor = match ($aRiesgo) { 'Cr\u00edtico' => '#ef4444', 'Alto' => '#f97316', 'Medio' => '#eab308', 'Bajo' => '#22c55e', default => '#64748b' };
            $aEColor = $aEstado === 'Atendida' ? '#16a34a' : '#f97316';
            $bg = ($aIdx % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rows .= '<tr style="background-color:'.$bg.';">'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$aNum.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">'.$aMat.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">'.$aNom.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'
                . '<span style="background:'.$aRColor.';color:#ffffff;padding:1px 4px;border-radius:2px;font-weight:700;font-size:6.5pt;">'.$aRiesgo.'</span></td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'.$aPunt.'</td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;text-align:center;">'
                . '<span style="background:'.$aEColor.';color:#ffffff;padding:1px 4px;border-radius:2px;font-size:6.5pt;">'.$aEstado.'</span></td>'
                . '<td style="padding:2px 4px;border-bottom:1px solid #e2e8f0;font-size:7pt;">'.$aPeriodo.'</td>'
                . '</tr>';
            $aIdx++;
        }
        $alertasSection = '<div class="section-title">8. Alertas Recientes</div>'
            . '<p class="paragraph">Las siguientes son las alertas de deserci\u00f3n m\u00e1s recientes registradas en el sistema.</p>'
            . '<table style="width:100%;border-collapse:collapse;margin-top:3px;"><thead><tr style="background-color:#4f46e5;">'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">#</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:left;font-size:6.5pt;border:1px solid #4f46e5;">Matr\u00edcula</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:left;font-size:6.5pt;border:1px solid #4f46e5;">Alumno</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">Riesgo</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">Puntaje</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">Estado</th>'
            . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:left;font-size:6.5pt;border:1px solid #4f46e5;">Periodo</th>'
            . '</tr></thead><tbody>'.$rows.'</tbody></table>';
    }

    $sellos = $data['sellos'] ?? [];
    if (count($sellos) === 0) {
        $sellos = [
            ['titulo' => 'Sello SIVACAD', 'descripcion' => 'Sello oficial del Sistema Integral de Valoraci\u00f3n del Conocimiento y Aprovechamiento Acad\u00e9mico'],
            ['titulo' => 'Sello Divisi\u00f3n ISC', 'descripcion' => 'Sello de la Divisi\u00f3n de Ingenier\u00eda en Sistemas Computacionales'],
            ['titulo' => 'Sello Control Escolar', 'descripcion' => 'Sello oficial de Control Escolar'],
        ];
    }
    $sello1 = ''; $sello2 = ''; $sello3 = '';
    $sIdx = 0;
    foreach (array_slice($sellos, 0, 3) as $s) {
        $tit = htmlspecialchars($s['titulo'] ?? '', ENT_QUOTES, 'UTF-8');
        $des = htmlspecialchars($s['descripcion'] ?? '', ENT_QUOTES, 'UTF-8');
        $sb = '<div style="border-top:1px solid #000000;padding-top:5px;margin:0 10px;">'
            . '<div style="font-size:7pt;font-weight:700;color:#0f172a;">'.$tit.'</div>'
            . '<div style="font-size:5.5pt;color:#64748b;margin-top:2px;">'.$des.'</div>'
            . '</div>';
        if ($sIdx === 0) $sello1 = $sb;
        elseif ($sIdx === 1) $sello2 = $sb;
        else $sello3 = $sb;
        $sIdx++;
    }

    $logoPath = __DIR__ . '/../../frontend/src/assets';
    $logoTecnm   = base64_encode_file($logoPath . '/Logo-TecNM.png');
    $logoSivacad = base64_encode_file($logoPath . '/Logo-SIVACAD.jpeg');
    $logoTesi    = base64_encode_file($logoPath . '/Logo-TESI.png');
    $watermark   = base64_encode_file($logoPath . '/marcadeagua_SIVACAD.jpeg');
    $selloSivacad = base64_encode_file($logoPath . '/Sello-SIVACAD.jpeg');
    $wmStyle = $watermark ? "background-image: url('data:image/jpeg;base64,{$watermark}');" : '';
    $copyHeader = '<div style="font-size:6.5pt;color:#64748b;text-align:center;font-weight:600;margin-bottom:3px;">SIVACAD-ISC &mdash; &copy; 2026 B&aacute;rcenas Gonz&aacute;lez Laura Casandra &amp; Morales Ibarra Sandivel &mdash; TESI &mdash; Ingenier&iacute;a en Sistemas Computacionales</div>';
    $selloImg = $selloSivacad ? '<img src="data:image/jpeg;base64,' . $selloSivacad . '" style="height:28px;opacity:0.85;" alt="Sello SIVACAD"/>' : '';
    $alertColor = $tasaAt >= 50 ? '#16a34a' : '#dc2626';
    $pctAltoCritico = $totalDist > 0 ? round((($criticos + $alto) / $totalDist) * 100, 1) : 0;

    return '<!DOCTYPE html>'
    . '<html lang="es-MX"><head><meta charset="UTF-8"><style>'
    . '@page{margin:2.54cm 2.54cm 3.0cm 3.0cm;size:letter;}'
    . '*{margin:0;padding:0;}'
    . 'body{font-family:Helvetica,Arial,sans-serif;font-size:9pt;color:#0f172a;line-height:1.35;}'
    . '.watermark{position:fixed;top:0;left:0;right:0;bottom:0;background-size:100% 100%;background-position:center;background-repeat:no-repeat;opacity:0.06;z-index:-1;pointer-events:none;'.$wmStyle.'}'
    . '.section-title{font-size:10pt;font-weight:700;color:#0f172a;border-bottom:2px solid #4f46e5;padding-bottom:2px;margin:10px 0 6px 0;text-transform:uppercase;letter-spacing:0.3px;}'
    . '.paragraph{font-size:7.5pt;color:#334155;text-align:justify;line-height:1.5;margin-bottom:5px;}'
    . '.fixed-bottom{position:fixed;bottom:0;left:0;right:0;z-index:10;}'
    . 'td,th{vertical-align:middle;}'
    . 'table{page-break-inside:avoid;}'
    . '</style></head><body>'
    . '<div class="watermark"></div>'

    // LOGOS
    . '<table style="width:100%;border-collapse:collapse;border:none;"><tr>'
    . '<td style="width:33%;text-align:left;vertical-align:middle;border:none;padding:0;"><img src="data:image/png;base64,'.$logoTecnm.'" style="height:48px;" alt="TecNM"></td>'
    . '<td style="width:34%;text-align:center;vertical-align:middle;border:none;padding:0;"><img src="data:image/jpeg;base64,'.$logoSivacad.'" style="height:48px;" alt="SIVACAD"></td>'
    . '<td style="width:33%;text-align:right;vertical-align:middle;border:none;padding:0;"><img src="data:image/png;base64,'.$logoTesi.'" style="height:48px;" alt="TESI"></td>'
    . '</tr></table>'

    // TITULO
    . '<table style="width:100%;border-collapse:collapse;border:none;margin-top:1px;"><tr>'
    . '<td style="text-align:center;font-size:12pt;font-weight:700;color:#0f172a;padding:2px 0;">REPORTE ESTRAT\u00c9GICO DE RIESGO DE DESERCI\u00d3N</td></tr>'
    . '<tr><td style="text-align:center;font-size:6.5pt;font-weight:600;color:#4f46e5;text-transform:uppercase;letter-spacing:0.5px;padding:1px 0;">SISTEMA INTEGRAL PARA LA VALORACI\u00d3N DEL CONOCIMIENTO Y APROVECHAMIENTO ACAD\u00c9MICO</td></tr>'
    . '</table>'

    // METADATOS
    . '<table style="width:100%;border-collapse:collapse;border:none;margin-top:1px;"><tr>'
    . '<td style="text-align:center;font-size:6pt;color:#475569;border-bottom:1px solid #cbd5e1;padding:2px 0 3px 0;">'
    . 'Folio: <strong>'.$folio.'</strong> &nbsp;|&nbsp; Periodo: <strong>'.$periodo.'</strong> &nbsp;|&nbsp; '
    . 'Generado: <strong>'.$fecha.'</strong> &nbsp;|&nbsp; Por: <strong>'.$generadoPor.'</strong>'
    . '</td></tr></table>'

    // 1. RESUMEN EJECUTIVO
    . '<div class="section-title">1. Resumen Ejecutivo</div>'
    . '<p class="paragraph">El presente reporte estrat\u00e9gico consolida el an\u00e1lisis de riesgo acad\u00e9mico del per\u00edodo <strong>'.$periodo.'</strong>. El sistema SIVACAD tiene registrados <strong>'.$alumnos.'</strong> alumnos, <strong>'.$docentes.'</strong> docentes y <strong>'.$grupos.'</strong> grupos bajo cobertura institucional. Se han generado <strong>'.$totalAl.'</strong> alertas de deserci\u00f3n, de las cuales <strong style="color:#f97316;">'.$pendientes.'</strong> est\u00e1n pendientes de atenci\u00f3n y <strong style="color:#16a34a;">'.$atendidas.'</strong> han sido atendidas, lo que representa una tasa de atenci\u00f3n del <strong style="color:'.$alertColor.';">'.$tasaAt.'%</strong>.</p>'

    // INDICADORES
    . '<table style="width:100%;border-collapse:collapse;border:none;margin-top:4px;"><tr>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Alertas Totales</div><div style="font-size:13pt;font-weight:700;color:#4f46e5;">'.$totalAl.'</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Pendientes</div><div style="font-size:13pt;font-weight:700;color:#f97316;">'.$pendientes.'</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Atendidas</div><div style="font-size:13pt;font-weight:700;color:#16a34a;">'.$atendidas.'</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Tasa Atenci\u00f3n</div><div style="font-size:13pt;font-weight:700;color:'.$alertColor.';">'.$tasaAt.'%</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Alumnos</div><div style="font-size:13pt;font-weight:700;color:#3b82f6;">'.$alumnos.'</div></td>'
    . '<td style="width:16.66%;text-align:center;border:1px solid #e2e8f0;padding:4px 2px;background:#f8fafc;"><div style="font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Grupos</div><div style="font-size:13pt;font-weight:700;color:#8b5cf6;">'.$grupos.'</div></td>'
    . '</tr></table>'

    // 2. DISTRIBUCI\u00d3N DE RIESGO
    . '<div class="section-title">2. Distribuci\u00f3n de Riesgo Acad\u00e9mico</div>'
    . '<p class="paragraph">La distribuci\u00f3n de riesgo entre los <strong>'.$totalDist.'</strong> casos analizados muestra que el <strong>'.$pctAltoCritico.'%</strong> de los casos se concentra en niveles Alto o Cr\u00edtico, lo que representa una se\u00f1al de alerta institucional que requiere atenci\u00f3n inmediata por parte de las autoridades acad\u00e9micas.</p>'
    . '<table style="width:100%;border-collapse:collapse;margin-top:3px;"><thead><tr style="background-color:#4f46e5;">'
    . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:left;font-size:6.5pt;border:1px solid #4f46e5;">Nivel de Riesgo</th>'
    . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">Total</th>'
    . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">Porcentaje</th>'
    . '<th style="color:#ffffff;padding:3px 4px;font-weight:600;text-align:center;font-size:6.5pt;border:1px solid #4f46e5;">Descripci\u00f3n</th>'
    . '</tr></thead><tbody>'.$distRowsHtml.'</tbody></table>'
    . '<table style="width:100%;border-collapse:collapse;border:none;margin-top:4px;"><tr><td style="border:none;padding:0;">'
    . '<table style="width:100%;border-collapse:collapse;border:none;">'.$distBarHtml.'</table>'
    . '</td></tr></table>'

    // 3. PARCIALES
    . $parcialSection

    // 4. CICLOS
    . $ciclosSection

    // 5. INSIGHTS
    . '<div class="section-title">5. Insights Estrat\u00e9gicos</div>'
    . '<p class="paragraph">A continuaci\u00f3n se presentan los hallazgos clave del an\u00e1lisis automatizado de deserci\u00f3n, generados mediante el modelo de inteligencia artificial de SIVACAD.</p>'
    . $insightsHtml

    // 6. CARRERA
    . $carreraSection

    // 7. PROGRESI\u00d3N
    . $progSection

    // 8. ALERTAS
    . $alertasSection

    // 9. MATERIAS
    . $materiaSection

    . '<div style="height:50px;"></div>'
    . '<div class="fixed-bottom">'
    . '<table style="width:100%;border-collapse:collapse;border:none;"><tr>'
    . '<td style="width:25%;vertical-align:middle;text-align:left;border:none;padding:4px;">'.$selloImg.'</td>'
    . '<td style="width:25%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">'.$sello1.'</td>'
    . '<td style="width:25%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">'.$sello2.'</td>'
    . '<td style="width:25%;vertical-align:top;text-align:center;border:none;padding:4px 8px 0 8px;">'.$sello3.'</td>'
    . '</tr></table>'
    . '<table style="width:100%;border-collapse:collapse;border:none;"><tr>'
    . '<td style="text-align:center;font-size:5.5pt;color:#94a3b8;border-top:1px solid #cbd5e1;padding:3px 0;">'
    . 'Documento generado por SIVACAD-ISC &copy; 2026 B&aacute;rcenas Gonz&aacute;lez Laura Casandra &amp; Morales Ibarra Sandivel &mdash; '
    . 'TESI &mdash; Ingenier&iacute;a en Sistemas Computacionales &mdash; Proyecto de Titulaci&oacute;n &mdash; '
    . 'Folio: '.$folio.' &mdash; Periodo: '.$periodo.' &mdash; <strong>CONFIDENCIAL</strong> &mdash; Uso Acad\u00e9mico Exclusivo'
    . '</td></tr></table>'
    . '</div>'
    . '</body></html>';
}
