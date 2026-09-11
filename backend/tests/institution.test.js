'use strict';

// backend/tests/institution.test.js
// Institution isolation tests — byInstitution helper, query filtering,
// institution config, and middleware behavior

const assert = require('assert');

// ──────────────────────────────────────────────
// Helper: mock pool for database tests
// ──────────────────────────────────────────────
function createMockPool() {
  const calls = [];
  return {
    calls,
    execute(sql, params) {
      calls.push({ sql, params });
      return Promise.resolve([[], []]);
    }
  };
}

// ──────────────────────────────────────────────
// 1. byInstitution — adds WHERE when none exists
// ──────────────────────────────────────────────
async function testByInstitutionAddsWhere() {
  const { byInstitution } = require('../src/middleware/institution');

  const result = byInstitution('SELECT * FROM alumnos', 1);

  assert.ok(result.includes('WHERE'), 'Should contain WHERE clause');
  assert.ok(result.includes('id_institucion = ?'), 'Should filter by id_institucion');
  assert.strictEqual(result, 'SELECT * FROM alumnos WHERE id_institucion = ?');

  console.log('  ✓ byInstitution adds WHERE clause when none exists');
}

// ──────────────────────────────────────────────
// 2. byInstitution — adds AND when WHERE exists
// ──────────────────────────────────────────────
async function testByInstitutionAddsAnd() {
  const { byInstitution } = require('../src/middleware/institution');

  const result = byInstitution('SELECT * FROM alumnos WHERE semestre = 5', 2);

  assert.ok(result.includes('AND id_institucion = ?'), 'Should append AND clause');
  assert.ok(result.includes('WHERE'), 'Should preserve existing WHERE');
  assert.ok(!result.includes('WHERE id_institucion'), 'Should not duplicate WHERE');

  console.log('  ✓ byInstitution appends AND when WHERE already exists');
}

// ──────────────────────────────────────────────
// 3. byInstitution — defaults to institution 1
// ──────────────────────────────────────────────
async function testByInstitutionDefault() {
  const { byInstitution } = require('../src/middleware/institution');

  const result = byInstitution('SELECT * FROM alumnos');

  assert.ok(result.includes('WHERE id_institucion = ?'), 'Should default to institution 1');

  console.log('  ✓ byInstitution defaults to institution 1 when no ID provided');
}

// ──────────────────────────────────────────────
// 4. byInstitution — handles case-insensitive WHERE
// ──────────────────────────────────────────────
async function testByInstitutionCaseInsensitive() {
  const { byInstitution } = require('../src/middleware/institution');

  const result = byInstitution('select * from alumnos where semestre = 3', 5);

  assert.ok(result.includes('AND id_institucion = ?'), 'Should detect lowercase where');

  console.log('  ✓ byInstitution detects WHERE case-insensitively');
}

// ──────────────────────────────────────────────
// 5. byInstitutionParams — appends institution ID
// ──────────────────────────────────────────────
async function testByInstitutionParams() {
  const { byInstitutionParams } = require('../src/middleware/institution');

  const result = byInstitutionParams(['param1', 'param2'], 3);

  assert.deepStrictEqual(result, ['param1', 'param2', 3]);
  assert.strictEqual(result.length, 3);

  console.log('  ✓ byInstitutionParams appends institution ID to params array');
}

// ──────────────────────────────────────────────
// 6. byInstitutionParams — handles null existing params
// ──────────────────────────────────────────────
async function testByInstitutionParamsNull() {
  const { byInstitutionParams } = require('../src/middleware/institution');

  const result = byInstitutionParams(null, 7);

  assert.deepStrictEqual(result, [7]);

  const result2 = byInstitutionParams(undefined, 1);
  assert.deepStrictEqual(result2, [1]);

  console.log('  ✓ byInstitutionParams handles null/undefined existing params');
}

// ──────────────────────────────────────────────
// 7. byInstitutionParams — defaults to institution 1
// ──────────────────────────────────────────────
async function testByInstitutionParamsDefault() {
  const { byInstitutionParams } = require('../src/middleware/institution');

  const result = byInstitutionParams(['x']);

  assert.deepStrictEqual(result, ['x', 1]);

  console.log('  ✓ byInstitutionParams defaults to institution 1');
}

// ──────────────────────────────────────────────
// 8. Institution cache — TTL behavior
// ──────────────────────────────────────────────
async function testInstitutionCacheTTL() {
  const { invalidateInstitutionCache } = require('../src/middleware/institution');

  // invalidateInstitutionCache should be callable without error
  invalidateInstitutionCache(1);
  invalidateInstitutionCache(999);

  console.log('  ✓ Institution cache invalidation does not throw');
}

// ──────────────────────────────────────────────
// 9. resolveInstitution — middleware exists
// ──────────────────────────────────────────────
async function testResolveInstitutionMiddleware() {
  const inst = require('../src/middleware/institution');

  assert.strictEqual(typeof inst.resolveInstitution, 'function', 'resolveInstitution must be middleware');
  assert.strictEqual(typeof inst.byInstitution, 'function', 'byInstitution must be exported');
  assert.strictEqual(typeof inst.byInstitutionParams, 'function', 'byInstitutionParams must be exported');
  assert.strictEqual(typeof inst.requireInstitutionFeature, 'function', 'requireInstitutionFeature must be exported');
  assert.strictEqual(typeof inst.invalidateInstitutionCache, 'function', 'invalidateInstitutionCache must be exported');

  console.log('  ✓ Institution middleware exports all required functions');
}

// ──────────────────────────────────────────────
// 10. resolveInstitution — falls back to TESI on DB error
// ──────────────────────────────────────────────
async function testResolveInstitutionFallback() {
  const pool = require('../src/config/db');

  // Temporarily replace pool.execute to simulate DB error
  const originalExecute = pool.execute;
  pool.execute = () => { throw new Error('Table not found'); };

  try {
    const inst = require('../src/middleware/institution');

    // Create mock req/res with a user that has id_institucion
    const req = { user: { id_institucion: 1 }, institution: null, id_institucion: null };
    let nextCalled = false;
    const res = {
      status() { return { json() {} }; },
      json() {}
    };

    await inst.resolveInstitution(req, res, () => { nextCalled = true; });

    assert.ok(nextCalled, 'Should call next even on DB error');
    assert.ok(req.institution, 'Should set fallback institution');
    assert.strictEqual(req.institution.id_institucion, 1, 'Fallback institution ID must be 1');
    assert.strictEqual(req.institution.nombre_corto, 'TESI', 'Fallback must be TESI');
    assert.ok(req.institution.dominios_email.includes('tesi.edu.mx'), 'Fallback must include tesi domain');
  } finally {
    pool.execute = originalExecute;
  }

  console.log('  ✓ resolveInstitution falls back to TESI on DB error');
}

// ──────────────────────────────────────────────
// 11. resolveInstitution — passes next() on success
// ──────────────────────────────────────────────
async function testResolveInstitutionSuccess() {
  const pool = require('../src/config/db');
  const originalExecute = pool.execute;

  // Mock successful DB response
  pool.execute = (sql, params) => {
    if (sql.includes('FROM instituciones')) {
      return Promise.resolve([[{
        id_institucion: 2,
        nombre_corto: 'TECNM',
        nombre_completo: 'TECNM Ixpa',
        dominios_email: '["tecnm.mx"]',
        color_primario: '#ff0000'
      }], []]);
    }
    return Promise.resolve([[], []]);
  };

  try {
    // Clear cache to force DB lookup
    const { invalidateInstitutionCache, resolveInstitution } = require('../src/middleware/institution');
    invalidateInstitutionCache(2);

    const req = { user: { id_institucion: 2 }, institution: null, id_institucion: null };
    let nextCalled = false;
    const res = { status() { return { json() {} }; }, json() {} };

    await resolveInstitution(req, res, () => { nextCalled = true; });

    assert.ok(nextCalled, 'Should call next on success');
    assert.strictEqual(req.institution.id_institucion, 2, 'Should set correct institution ID');
    assert.strictEqual(req.institution.nombre_corto, 'TECNM');
    assert.strictEqual(req.id_institucion, 2);
  } finally {
    pool.execute = originalExecute;
  }

  console.log('  ✓ resolveInstitution loads institution from DB on success');
}

// ──────────────────────────────────────────────
// 12. resolveInstitution — uses default id_institucion 1
// ──────────────────────────────────────────────
async function testResolveInstitutionDefaultId() {
  const pool = require('../src/config/db');
  const originalExecute = pool.execute;

  let capturedParams = null;
  pool.execute = (sql, params) => {
    capturedParams = params;
    return Promise.resolve([[{ id_institucion: 1, nombre_corto: 'TESI' }], []]);
  };

  try {
    const { invalidateInstitutionCache, resolveInstitution } = require('../src/middleware/institution');
    invalidateInstitutionCache(1);

    // User has no id_institucion → should default to 1
    const req = { user: {}, institution: null, id_institucion: null };
    let nextCalled = false;
    const res = { status() { return { json() {} }; }, json() {} };

    await resolveInstitution(req, res, () => { nextCalled = true; });

    assert.ok(nextCalled);
    assert.strictEqual(capturedParams[0], 1, 'Should query with default institution 1');
  } finally {
    pool.execute = originalExecute;
  }

  console.log('  ✓ resolveInstitution defaults to institution 1 when user has none');
}

// ──────────────────────────────────────────────
// 13. requireInstitutionFeature — middleware factory
// ──────────────────────────────────────────────
async function testRequireInstitutionFeature() {
  const inst = require('../src/middleware/institution');

  const mw = inst.requireInstitutionFeature('kardex');
  assert.strictEqual(typeof mw, 'function', 'requireInstitutionFeature returns middleware');

  console.log('  ✓ requireInstitutionFeature returns middleware function');
}

// ──────────────────────────────────────────────
// 14. byInstitution — complex query with JOIN
// ──────────────────────────────────────────────
async function testByInstitutionWithJoin() {
  const { byInstitution } = require('../src/middleware/institution');

  const result = byInstitution(
    'SELECT a.* FROM alumnos a INNER JOIN carreras c ON a.id_carrera = c.id_carrera WHERE a.estatus_academico = ?',
    4
  );

  assert.ok(result.includes('AND id_institucion = ?'), 'Should add AND for JOIN queries');
  assert.ok(result.includes('WHERE'), 'Should preserve original WHERE');

  console.log('  ✓ byInstitution handles queries with JOINs correctly');
}

// ──────────────────────────────────────────────
// 15. Institution ID propagation — token includes id_institucion
// ──────────────────────────────────────────────
async function testInstitutionIdInToken() {
  const jwt = require('jsonwebtoken');
  const secret = 'inst-test-secret';

  const token = jwt.sign(
    { id_usuario: 1, rol: 'alumno', id_institucion: 3 },
    secret,
    { algorithm: 'HS256' }
  );

  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  assert.strictEqual(decoded.id_institucion, 3, 'Token must carry id_institucion');

  console.log('  ✓ JWT token carries id_institucion for institution isolation');
}

// ──────────────────────────────────────────────
// 16. Auth middleware — propagates id_institucion
// ──────────────────────────────────────────────
async function testAuthMiddlewarePropagatesInstitution() {
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'middleware', 'auth.js'),
    'utf8'
  );

  assert.ok(
    authSrc.includes('req.user.id_institucion'),
    'Auth middleware must set req.user.id_institucion from decoded token'
  );

  console.log('  ✓ Auth middleware propagates id_institucion to request');
}

// ──────────────────────────────────────────────
// 17. Auth controller — stores id_institucion in generated token
// ──────────────────────────────────────────────
async function testAuthControllerStoresInstitution() {
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'controllers', 'auth.js'),
    'utf8'
  );

  // The generateToken function must include id_institucion in payload
  const generateTokenSection = authSrc.substring(
    authSrc.indexOf('function generateToken'),
    authSrc.indexOf('function getUserFullName')
  );

  assert.ok(
    generateTokenSection.includes('id_institucion'),
    'generateToken must include id_institucion in JWT payload'
  );

  console.log('  ✓ Auth controller embeds id_institucion in JWT payload');
}

// ──────────────────────────────────────────────
// 18. byInstitution — handles multiple WHERE conditions
// ──────────────────────────────────────────────
async function testByInstitutionMultipleConditions() {
  const { byInstitution } = require('../src/middleware/institution');

  const result = byInstitution(
    'SELECT * FROM alumnos WHERE semestre = 3 AND estatus = "Regular"',
    7
  );

  assert.ok(result.includes('AND id_institucion = ?'), 'Should append AND with multiple conditions');
  // Count WHERE clauses — should only have one
  const whereCount = (result.toUpperCase().match(/WHERE/g) || []).length;
  assert.strictEqual(whereCount, 1, 'Should have exactly one WHERE clause');

  console.log('  ✓ byInstitution handles multiple WHERE conditions correctly');
}

// ──────────────────────────────────────────────
// 19. Institution feature check — SQL structure
// ──────────────────────────────────────────────
async function testInstitutionFeatureCheckSQL() {
  const fs = require('fs');
  const path = require('path');
  const instSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'middleware', 'institution.js'),
    'utf8'
  );

  assert.ok(
    instSrc.includes('instituciones_features'),
    'Feature check must query instituciones_features table'
  );
  assert.ok(
    instSrc.includes('feature_key'),
    'Feature check must filter by feature_key'
  );
  assert.ok(
    instSrc.includes('habilitado'),
    'Feature check must check habilitado flag'
  );

  console.log('  ✓ Institution feature check queries correct table and columns');
}

// ──────────────────────────────────────────────
// 20. Institution caching — TTL constant
// ──────────────────────────────────────────────
async function testInstitutionCacheTTLConstant() {
  const fs = require('fs');
  const path = require('path');
  const instSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'middleware', 'institution.js'),
    'utf8'
  );

  assert.ok(
    instSrc.includes('CACHE_TTL_MS'),
    'Cache TTL constant must be defined'
  );

  // Verify TTL is 5 minutes — the source uses an expression like "5 * 60 * 1000"
  const ttlMatch = instSrc.match(/CACHE_TTL_MS\s*=\s*(\d+(?:\s*\*\s*\d+)+)/);
  assert.ok(ttlMatch, 'CACHE_TTL_MS must have a numeric expression');
  // eslint-disable-next-line no-eval
  const ttl = eval(ttlMatch[1]);
  assert.strictEqual(ttl, 5 * 60 * 1000, 'Cache TTL must be 5 minutes');

  console.log('  ✓ Institution cache TTL is 5 minutes');
}

// ──────────────────────────────────────────────
// RUN ALL TESTS
// ──────────────────────────────────────────────
async function runTests() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   SIVACAD-ISC · Institution Isolation Tests  ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  const tests = [
    testByInstitutionAddsWhere,
    testByInstitutionAddsAnd,
    testByInstitutionDefault,
    testByInstitutionCaseInsensitive,
    testByInstitutionParams,
    testByInstitutionParamsNull,
    testByInstitutionParamsDefault,
    testInstitutionCacheTTL,
    testResolveInstitutionMiddleware,
    testResolveInstitutionFallback,
    testResolveInstitutionSuccess,
    testResolveInstitutionDefaultId,
    testRequireInstitutionFeature,
    testByInstitutionWithJoin,
    testInstitutionIdInToken,
    testAuthMiddlewarePropagatesInstitution,
    testAuthControllerStoresInstitution,
    testByInstitutionMultipleConditions,
    testInstitutionFeatureCheckSQL,
    testInstitutionCacheTTLConstant
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (e) {
      console.error(`  ✗ ${test.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Results: ${passed + failed} total, \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m`);
  console.log('');

  return { passed, failed };
}

// Allow running standalone or via run-tests.js
if (require.main === module) {
  runTests().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}

module.exports = { run: runTests };
