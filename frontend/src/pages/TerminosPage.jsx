/**
 * SIVACAD-ISC — Copyright (c) 2026 Bárcenas González Laura Casandra &
 *                    Morales Ibarra Sandivel — TESI — ISC
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function TerminosPage() {
    const navigate = useNavigate();

    return (
        <div className="page narrow">
            <section className="section-card">
                <div className="section-head">
                    <div>
                        <div className="eyebrow">SIVACAD | ISC</div>
                        <h2>Términos y Condiciones</h2>
                        <p style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
                            Última actualización: Julio 2026
                        </p>
                    </div>
                    <button className="btn secondary" type="button" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} /> Volver
                    </button>
                </div>

                <div className="auth-note" style={{ marginBottom: '1rem' }}>
                    <div className="eyebrow"><ShieldCheck size={14} /> Aceptación legal</div>
                    <p style={{ marginTop: '0.4rem', marginBottom: 0, lineHeight: 1.7 }}>
                        Al utilizar SIVACAD-ISC, aceptas los siguientes términos y condiciones.
                    </p>
                </div>

                <div style={{ lineHeight: 1.8, fontSize: '0.95rem' }}>
                    <h3>1. Identificación de las Autoras</h3>
                    <p>
                        El sistema SIVACAD-ISC (Sistema Integral para la Administración y Control
                        Académico de la carrera de Ingeniería en Sistemas Computacionales) fue
                        desarrollado por:
                    </p>
                    <ul>
                        <li><strong>Bárcenas González Laura Casandra</strong></li>
                        <li><strong>Morales Ibarra Sandivel</strong></li>
                    </ul>
                    <p>
                        Egresadas de la carrera de <strong>Ingeniería en Sistemas Computacionales</strong> del
                        <strong>Tecnológico de Estudios Superiores de Ixtapaluca (TESI)</strong>.
                    </p>
                    <p>
                        Este sistema fue creado como <strong>proyecto de titulación</strong> y es
                        de uso exclusivo para la carrera de Ingeniería en Sistemas Computacionales
                        del TESI.
                    </p>

                    <h3>2. Propiedad Intelectual</h3>
                    <p>
                        Todo el código fuente, diseño, documentación, logotipos, marcas de agua,
                        plantillas de documentos y cualquier otro elemento del sistema SIVACAD-ISC
                        es propiedad intelectual exclusiva de Bárcenas González Laura Casandra y
                        Morales Ibarra Sandivel.
                    </p>
                    <p>
                        Queda estrictamente prohibida:
                    </p>
                    <ul>
                        <li>La reproducción total o parcial del sistema sin autorización expresa</li>
                        <li>La distribución del sistema a terceros fuera de la carrera de ISC del TESI</li>
                        <li>La modificación del código fuente sin consentimiento de las autoras</li>
                        <li>El uso comercial del sistema o de cualquiera de sus componentes</li>
                        <li>La eliminación o alteración de los avisos de derechos de autor</li>
                    </ul>

                    <h3>3. Licencia de Uso</h3>
                    <p>
                        Este trabajo está licenciado bajo <strong>Creative Commons
                        Atribución-NoComercial-SinDerivadas 4.0 Internacional (CC BY-NC-ND 4.0)</strong>.
                    </p>
                    <p>
                        Esto significa que puedes utilizar el sistema únicamente para fines académicos
                        e institucionales dentro de la carrera de Ingeniería en Sistemas Computacionales
                        del TESI, siempre y cuando se otorgue el crédito correspondiente a las autoras.
                    </p>

                    <h3>4. Limitación de Responsabilidad</h3>
                    <p>
                        El sistema se proporciona "tal cual", sin garantías de ningún tipo. Las autoras
                        no se hacen responsables por daños directos o indirectos derivados del uso
                        del sistema.
                    </p>

                    <h3>5. Jurisdicción</h3>
                    <p>
                        Este documento se rige por las leyes de los <strong>Estados Unidos Mexicanos</strong>
                        y cualquier controversia será competencia de los tribunales del
                        <strong>Estado de México</strong>.
                    </p>
                </div>
            </section>
        </div>
    );
}
