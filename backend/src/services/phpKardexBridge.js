'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PHP_PDF_SCRIPT = path.join(__dirname, '..', '..', 'php-kardex', 'generate-kardex.php');
const PHP_EXCEL_SCRIPT = path.join(__dirname, '..', '..', 'php-kardex', 'generar_kardex_excel.php');
const PHP_BINARY = process.env.PHP_PATH || 'php';
const TIMEOUT_MS = 30000;

/**
 * Genera un PDF usando Dompdf vía PHP
 * @param {Object} data - Datos estructurados del kardex
 * @returns {Promise<Buffer>} Buffer del PDF generado
 */
function runPhpScript(scriptPath, args, stdinData) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Script PHP no encontrado: ${scriptPath}`));
    }

    const D_FLAGS = ['-d', 'display_errors=0', '-d', 'error_reporting=E_ALL&~E_WARNING&~E_NOTICE'];
    const child = spawn(PHP_BINARY, [...D_FLAGS, scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env }
    });

    const chunks = [];
    const errorChunks = [];

    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => errorChunks.push(chunk));

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGTERM');
        reject(new Error('Tiempo de espera agotado al generar con PHP'));
      }
    }, TIMEOUT_MS);

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        const stderr = Buffer.concat(errorChunks).toString('utf8').trim();
        return reject(new Error(stderr || `PHP script exited with code ${code}`));
      }

      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        return reject(new Error('PHP no generó salida'));
      }

      resolve(buffer);
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Error al ejecutar PHP: ${err.message}`));
    });

    if (stdinData) {
      child.stdin.write(stdinData);
    }
    child.stdin.end();
  });
}

async function generateKardexPdfWithPhp(data) {
  const jsonInput = JSON.stringify(data);
  return runPhpScript(PHP_PDF_SCRIPT, ['--stdin'], jsonInput);
}

async function generateKardexExcelWithPhp(idAlumno) {
  const idStr = String(idAlumno).trim();
  return runPhpScript(PHP_EXCEL_SCRIPT, [`id_alumno=${idStr}`], null);
}

/**
 * Verifica si PHP y Dompdf están disponibles
 */
async function isPhpAvailable() {
  try {
    return new Promise((resolve) => {
      const D_FLAGS = ['-d', 'display_errors=0', '-d', 'error_reporting=E_ALL&~E_WARNING&~E_NOTICE'];
      const child = spawn(PHP_BINARY, [...D_FLAGS, '-m'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk.toString(); });
      child.on('close', (code) => {
        resolve(code === 0 && output.includes('dompdf'));
      });
      child.on('error', () => resolve(false));
    });
  } catch {
    return false;
  }
}

module.exports = {
  generateKardexPdfWithPhp,
  generateKardexExcelWithPhp,
  isPhpAvailable
};
