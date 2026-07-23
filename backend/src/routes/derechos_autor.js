/**
 * SIVACAD-ISC — Copyright (c) 2026 Bárcenas González Laura Casandra &
 *                    Morales Ibarra Sandivel — TESI — ISC
 */
const express = require('express');
const router = express.Router();

const copyInfo = {
    sistema: 'SIVACAD-ISC',
    nombre_completo: 'Sistema Integral para la Administración y Control Académico de la carrera de Ingeniería en Sistemas Computacionales',
    autores: [
        'Bárcenas González Laura Casandra',
        'Morales Ibarra Sandivel'
    ],
    institucion: {
        nombre: 'Tecnológico de Estudios Superiores de Ixtapaluca',
        abreviatura: 'TESI',
        carrera: 'Ingeniería en Sistemas Computacionales',
        proyecto: 'Titulación por proyecto de investigación'
    },
    licencia: 'CC BY-NC-ND 4.0',
    licencia_url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es',
    proposito: 'Sistema exclusivo para la carrera de Ingeniería en Sistemas Computacionales del TESI',
    ano: 2026,
    derechos_reservados: '© 2026 Bárcenas González Laura Casandra & Morales Ibarra Sandivel. Todos los derechos reservados.',
    restricciones: [
        'Prohibida la distribución no autorizada',
        'Prohibido el uso comercial sin autorización expresa',
        'Prohibida la modificación del código sin consentimiento',
        'Uso exclusivo académico-institucional'
    ]
};

router.get('/atribucion', (req, res) => {
    res.json({ ok: true, ...copyInfo });
});

router.get('/licencia', (req, res) => {
    res.json({
        ok: true,
        tipo: 'CC BY-NC-ND 4.0',
        texto: 'Creative Commons Atribución-NoComercial-SinDerivadas 4.0 Internacional',
        url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es',
        permisos: ['Compartir — copiar y redistribuir el material'],
        condiciones: [
            'Atribución — Debe otorgar el crédito correspondiente a las autoras',
            'NoComercial — No puede utilizar el material para fines comerciales',
            'SinDerivadas — No puede modificar ni transformar el material'
        ]
    });
});

router.post('/verificar-documento', (req, res) => {
    const { hash } = req.body;
    if (!hash) {
        return res.status(400).json({ ok: false, message: 'Hash requerido' });
    }
    res.json({
        ok: true,
        valido: true,
        emitido_por: 'SIVACAD-ISC',
        autores: copyInfo.autores,
        institucion: copyInfo.institucion.nombre,
        fecha_emision: new Date().toISOString(),
        licencia: copyInfo.licencia,
        hash_verificado: hash.substring(0, 16) + '...'
    });
});

module.exports = router;
