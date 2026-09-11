'use strict';

async function main() {
  console.log('\n\x1b[35m╔══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[35m║   SIVACAD-ISC · Pruebas Integrales — Pipeline ML        ║\x1b[0m');
  console.log('\x1b[35m╚══════════════════════════════════════════════════════════╝\x1b[0m');
  console.log(`  Inicio: ${new Date().toISOString()}\n`);

  let totalPassed = 0;
  let totalFailed = 0;

  const suites = [
    { name: 'Security', file: './security.test' },
    { name: 'Institution', file: './institution.test' },
    { name: 'Additional Security', file: './additional-security.test' },
    { name: 'ML Bridge', file: './test-mlBridge' },
    { name: 'Predictor', file: './test-predictor' },
    { name: 'Métricas', file: './test-metrics' }
  ];

  for (const suite of suites) {
    const mod = require(suite.file);
    const result = await mod.run();
    totalPassed += result.passed;
    totalFailed += result.failed;
  }

  const total = totalPassed + totalFailed;

  console.log('\n\x1b[35m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log(`  \x1b[1mResultados: ${total} pruebas\x1b[0m`);
  console.log(`  \x1b[32m✓ Pasadas: ${totalPassed}\x1b[0m`);
  if (totalFailed > 0) console.log(`  \x1b[31m✗ Falladas: ${totalFailed}\x1b[0m`);
  else console.log(`  \x1b[32m✗ Falladas: 0\x1b[0m`);
  console.log(`  Fin: ${new Date().toISOString()}`);
  console.log('');

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\x1b[31mError fatal:\x1b[0m', err.message);
  process.exit(1);
});
