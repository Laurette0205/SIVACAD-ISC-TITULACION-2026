/**
 * SIVACAD-ISC — Copyright (c) 2026 Bárcenas González Laura Casandra &
 *                    Morales Ibarra Sandivel — TESI — ISC
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

export default function AvisoPrivacidadPage() {
    const navigate = useNavigate();

    return (
        <div className="page narrow">
            <section className="section-card">
                <div className="section-head">
                    <div>
                        <div className="eyebrow">SIVACAD | ISC</div>
                        <h2>Aviso de Privacidad</h2>
                        <p style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
                            Última actualización: Julio 2026
                        </p>
                    </div>
                    <button className="btn secondary" type="button" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} /> Volver
                    </button>
                </div>

                <div className="auth-note" style={{ marginBottom: '1rem' }}>
                    <div className="eyebrow"><Shield size={14} /> Protección de datos</div>
                    <p style={{ marginTop: '0.4rem', marginBottom: 0, lineHeight: 1.7 }}>
                        En cumplimiento con la Ley Federal de Protección de Datos Personales en
                        Posesión de los Particulares (LFPDPPP).
                    </p>
                </div>

                <div style={{ lineHeight: 1.8, fontSize: '0.95rem' }}>
                    <h3>1. Responsables del Tratamiento de Datos</h3>
                    <p>
                        <strong>Bárcenas González Laura Casandra</strong> y
                        <strong>Morales Ibarra Sandivel</strong>, egresadas de la carrera de
                        Ingeniería en Sistemas Computacionales del Tecnológico de Estudios
                        Superiores de Ixtapaluca (TESI), son las responsables del tratamiento
                        de sus datos personales.
                    </p>

                    <h3>2. Finalidad del Tratamiento</h3>
                    <p>Los datos personales recabados serán utilizados para las siguientes finalidades:</p>
                    <ul>
                        <li>Gestión académica (inscripciones, reinscripciones, kardex, evaluaciones)</li>
                        <li>Control de trámites escolares</li>
                        <li>Generación de documentos oficiales (kardex, constancias)</li>
                        <li>Análisis predictivo para prevención de deserción académica</li>
                        <li>Comunicación institucional relacionada con el sistema</li>
                    </ul>

                    <h3>3. Datos Recopilados</h3>
                    <ul>
                        <li>Nombre completo</li>
                        <li>Correo electrónico institucional</li>
                        <li>Matrícula o número de empleado</li>
                        <li>CURP</li>
                        <li>Fotografía institucional</li>
                        <li>Historial académico (calificaciones, créditos, periodos)</li>
                    </ul>

                    <h3>4. Derechos ARCO</h3>
                    <p>
                        Usted tiene derecho a <strong>Acceder</strong>, <strong>Rectificar</strong>,
                        <strong>Cancelar</strong> u <strong>Oponerse</strong> al tratamiento de sus
                        datos personales (Derechos ARCO). Para ejercer estos derechos, puede contactar
                        a las responsables a través del sistema o mediante los canales oficiales
                        del TESI.
                    </p>

                    <h3>5. Medidas de Seguridad</h3>
                    <p>
                        Se implementan medidas de seguridad administrativas, técnicas y físicas
                        para proteger sus datos personales contra daño, pérdida, alteración,
                        destrucción o uso no autorizado. Estas incluyen:
                    </p>
                    <ul>
                        <li>Almacenamiento con hash bcrypt de contraseñas</li>
                        <li>Autenticación mediante tokens JWT con expiración</li>
                        <li>Control de acceso basado en roles (RBAC)</li>
                        <li>Auditoría de todas las acciones realizadas en el sistema</li>
                        <li>Comunicación cifrada mediante HTTPS</li>
                    </ul>

                    <h3>6. No Transferencia a Terceros</h3>
                    <p>
                        Sus datos personales no serán transferidos a terceros sin su consentimiento,
                        salvo las excepciones previstas en la LFPDPPP.
                    </p>

                    <h3>7. Vigencia</h3>
                    <p>
                        El presente aviso de privacidad podrá ser modificado en cualquier momento.
                        Las modificaciones serán publicadas en este mismo medio.
                    </p>
                </div>
            </section>
        </div>
    );
}
