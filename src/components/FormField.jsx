import React from 'react';

// ==============================
// 🧩 COMPONENTE: FormField
// ==============================
// Este componente encapsula un campo de formulario
// con su etiqueta (label) y su contenido (input, select, etc.)
export function FormField({ label, children }) {
    return (
        <label className="field">
            {/* 🔹 TEXTO DEL LABEL */}
            <span className="field-label">
                {label}
            </span>

            {/* 🔹 INPUT / CONTROL */}
            <div className="field-control">
                {children}
            </div>
        </label>
    );
}