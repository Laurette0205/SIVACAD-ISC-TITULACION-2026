'use strict';
// Codemod: corrige queries que seleccionan nombre de docente desde `docentes`
// (esas columnas viven en `usuarios`). Agrega JOIN usuarios y reescribe alias.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const ALIASES = ['dn', 'd'];
const COLS = ['apellido_paterno', 'apellido_materno', 'nombres'];

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

function oddBackticks(line) {
  return (line.match(/`/g) || []).length % 2 === 1;
}

let changedFiles = 0;
let changedBlocks = 0;

for (const file of walk(ROOT)) {
  const original = fs.readFileSync(file, 'utf8');
  const lines = original.split(/\r?\n/);
  let modified = false;

  // Identificar bloques (template literals) con JOIN docentes y sin JOIN usuarios
  const blocks = [];
  let start = null;
  for (let i = 0; i < lines.length; i++) {
    if (oddBackticks(lines[i])) {
      if (start === null) start = i;
      else { blocks.push([start, i]); start = null; }
    }
  }
  if (start !== null) blocks.push([start, lines.length - 1]);

  for (const [s, e] of [...blocks].reverse()) {
    const blockLines = lines.slice(s, e + 1);
    const blockText = blockLines.join('\n');
    if (!/JOIN\s+docentes\s+\w+\s+ON/i.test(blockText)) continue;
    if (/JOIN\s+usuarios/i.test(blockText)) continue;

    const usedAliases = [];
    for (const ln of blockLines) {
      const m = ln.match(/JOIN\s+docentes\s+(\w+)\s+ON/i);
      if (m) usedAliases.push(m[1]);
    }
    const aliases = [...new Set(usedAliases)];
    if (!aliases.length) continue;

    // Verificar que el bloque realmente referencia columnas de nombre
    const refsName = aliases.some(a => COLS.some(c => new RegExp(`\\b${a}\\.${c}\\b`).test(blockText)));
    if (!refsName) continue;

    let newBlock = blockLines.map(l => l);

    // Insertar JOIN usuarios después de cada JOIN docentes
    for (let i = 0; i < newBlock.length; i++) {
      const m = newBlock[i].match(/^(\s*)(LEFT\s+|INNER\s+|RIGHT\s+|)JOIN\s+docentes\s+(\w+)\s+ON\s+(.+)$/i);
      if (m) {
        const [, indent, jt, alias, on] = m;
        // evitar duplicado si ya existe
        if (!newBlock.some(l => new RegExp(`JOIN\\s+usuarios\\s+du\\s+ON\\s+du\\.id_usuario\\s*=\\s*${alias}\\.id_usuario`, 'i').test(l))) {
          newBlock.splice(i + 1, 0, `${indent}LEFT JOIN usuarios du ON du.id_usuario = ${alias}.id_usuario`);
          i++;
        }
      }
    }

    // Reescribir referencias de columnas de nombre al alias `du`
    newBlock = newBlock.map(l => {
      let out = l;
      for (const a of aliases) {
        for (const c of COLS) {
          out = out.replace(new RegExp(`\\b${a}\\.${c}\\b`, 'g'), `du.${c}`);
        }
      }
      return out;
    });

    if (newBlock.join('\n') !== blockText) {
      lines.splice(s, e - s + 1, ...newBlock);
      modified = true;
      changedBlocks++;
    }
  }

  if (modified) {
    fs.writeFileSync(file, lines.join('\n'));
    changedFiles++;
    console.log('FIXED', path.relative(process.cwd(), file));
  }
}

console.log(`\nBlocks: ${changedBlocks}, Files: ${changedFiles}`);
