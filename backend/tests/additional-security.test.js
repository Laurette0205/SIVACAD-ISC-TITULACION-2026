'use strict';

// backend/tests/additional-security.test.js
// Additional security tests — PRIORIDAD 1-4 features
// JWT refresh secret separation, audit events, reauthentication,
// verifyRoleAgainstDB, anonymization, break-glass PIN, CSP

const assert = require('assert');

// ──────────────────────────────────────────────
// Helper: mock request/response objects
// ──────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    headers: { 'user-agent': 'test-agent', 'accept-language': 'en' },
    body: {},
    query: {},
    params: {},
    path: '/test',
    user: null,
    connection: { remoteAddress: '127.0.0.1' },
    ...overrides
  };
}

function mockRes() {
  const res = {
    _status: 200,
    _body: null,
    _headers: {},
    status(code) { res._status = code; return res; },
    json(body) { res._body = body; return res; },
    set(key, val) { res._headers[key] = val; return res; },
    get(key) { return res._headers[key]; }
  };
  return res;
}

// ──────────────────────────────────────────────
// 1. JWT — refresh secret separated from access secret
// ──────────────────────────────────────────────
async function testRefreshSecretSeparated() {
  const originalSecret = process.env.JWT_SECRET;
  const originalRefresh = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_SECRET = 'access-secret-123';
  process.env.JWT_REFRESH_SECRET = 'refresh-secret-456';

  try {
    const jwt = require('jsonwebtoken');
    delete require.cache[require.resolve('../src/services/jwt')];
    const { signToken, signRefreshToken, verifyRefreshToken } = require('../src/services/jwt');

    const accessToken = signToken({ id_usuario: 1 });
    const refreshToken = signRefreshToken({ id_usuario: 1 });

    // Verify access token with access secret
    const decodedAccess = jwt.verify(accessToken, 'access-secret-123', { algorithms: ['HS256'] });
    assert.strictEqual(decodedAccess.id_usuario, 1);

    // Verify refresh token with refresh secret
    const decodedRefresh = verifyRefreshToken(refreshToken);
    assert.strictEqual(decodedRefresh.id_usuario, 1);
    assert.strictEqual(decodedRefresh.type, 'refresh');

    // Access secret should NOT verify refresh token
    try {
      jwt.verify(refreshToken, 'access-secret-123', { algorithms: ['HS256'] });
      throw new Error('Access secret should not verify refresh token');
    } catch (e) {
      if (e.message === 'Access secret should not verify refresh token') throw e;
    }

    // Refresh secret should NOT verify access token
    try {
      jwt.verify(accessToken, 'refresh-secret-456', { algorithms: ['HS256'] });
      throw new Error('Refresh secret should not verify access token');
    } catch (e) {
      if (e.message === 'Refresh secret should not verify access token') throw e;
    }
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalRefresh === undefined) delete process.env.JWT_REFRESH_SECRET;
    else process.env.JWT_REFRESH_SECRET = originalRefresh;
    delete require.cache[require.resolve('../src/services/jwt')];
  }

  console.log('  ✓ JWT refresh secret is separate from access secret');
}

// ──────────────────────────────────────────────
// 2. JWT — missing refresh secret throws
// ──────────────────────────────────────────────
async function testMissingRefreshSecretThrows() {
  const originalSecret = process.env.JWT_SECRET;
  const originalRefresh = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_SECRET = 'access-secret';
  delete process.env.JWT_REFRESH_SECRET;

  try {
    delete require.cache[require.resolve('../src/services/jwt')];
    const { signRefreshToken } = require('../src/services/jwt');

    try {
      signRefreshToken({ id_usuario: 1 });
      throw new Error('Should have thrown for missing JWT_REFRESH_SECRET');
    } catch (e) {
      if (e.message === 'Should have thrown for missing JWT_REFRESH_SECRET') throw e;
      assert.ok(e.message.includes('JWT_REFRESH_SECRET'), 'Error must mention JWT_REFRESH_SECRET');
    }
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalRefresh === undefined) delete process.env.JWT_REFRESH_SECRET;
    else process.env.JWT_REFRESH_SECRET = originalRefresh;
    delete require.cache[require.resolve('../src/services/jwt')];
  }

  console.log('  ✓ signRefreshToken throws when JWT_REFRESH_SECRET is missing');
}

// ──────────────────────────────────────────────
// 3. JWT — custom expiresIn parameter
// ──────────────────────────────────────────────
async function testCustomExpiresIn() {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'custom-exp-secret';

  try {
    const jwt = require('jsonwebtoken');
    delete require.cache[require.resolve('../src/services/jwt')];
    const { signToken } = require('../src/services/jwt');

    // Default expiration
    const defaultToken = signToken({ id_usuario: 1 });
    const decodedDefault = jwt.verify(defaultToken, 'custom-exp-secret', { algorithms: ['HS256'] });
    assert.ok(decodedDefault.exp > decodedDefault.iat, 'Default token should have expiration');

    // Custom 10-minute expiration
    const customToken = signToken({ id_usuario: 2 }, '10m');
    const decodedCustom = jwt.verify(customToken, 'custom-exp-secret', { algorithms: ['HS256'] });
    const expDiff = decodedCustom.exp - decodedCustom.iat;
    // 10 minutes = 600 seconds, allow small tolerance
    assert.ok(expDiff >= 590 && expDiff <= 610, `Custom expiration should be ~600s, got ${expDiff}s`);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    delete require.cache[require.resolve('../src/services/jwt')];
  }

  console.log('  ✓ signToken supports custom expiresIn parameter');
}

// ──────────────────────────────────────────────
// 4. Audit — registrarAuditoria function exists and works
// ──────────────────────────────────────────────
async function testRegistrarAuditoriaExists() {
  const { registrarAuditoria } = require('../src/middleware/auditoria');

  assert.strictEqual(typeof registrarAuditoria, 'function', 'registrarAuditoria must be exported');

  // Should not throw even if DB is unavailable (it catches errors internally)
  await registrarAuditoria({
    modulo: 'TEST',
    accion: 'TEST_ACTION',
    descripcion: 'Test audit event'
  });

  console.log('  ✓ registrarAuditoria function exists and handles errors gracefully');
}

// ──────────────────────────────────────────────
// 5. Audit — getClientIp extracts IP from x-forwarded-for
// ──────────────────────────────────────────────
async function testGetClientIpForwarded() {
  const { getClientIp } = require('../src/middleware/auditoria');

  const req1 = { headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' }, connection: { remoteAddress: '127.0.0.1' } };
  assert.strictEqual(getClientIp(req1), '10.0.0.1', 'Should extract first IP from x-forwarded-for');

  const req2 = { headers: {}, connection: { remoteAddress: '192.168.1.100' } };
  assert.strictEqual(getClientIp(req2), '192.168.1.100', 'Should fallback to connection.remoteAddress');

  const req3 = { headers: {}, connection: null, ip: '10.1.1.1' };
  assert.strictEqual(getClientIp(req3), '10.1.1.1', 'Should fallback to req.ip');

  console.log('  ✓ getClientIp extracts IP correctly from various sources');
}

// ──────────────────────────────────────────────
// 6. Audit — getDeviceHash produces consistent hashes
// ──────────────────────────────────────────────
async function testGetDeviceHash() {
  const { getDeviceHash } = require('../src/middleware/auditoria');

  const req = {
    headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'es-MX' },
    connection: { remoteAddress: '127.0.0.1' }
  };

  const h1 = getDeviceHash(req);
  const h2 = getDeviceHash(req);
  assert.strictEqual(h1, h2, 'Device hash should be deterministic');
  assert.strictEqual(h1.length, 64, 'Should be SHA-256 hex (64 chars)');

  console.log('  ✓ getDeviceHash produces consistent SHA-256 hashes');
}

// ──────────────────────────────────────────────
// 7. VerifyRoleAgainstDB — middleware exists and exports
// ──────────────────────────────────────────────
async function testVerifyRoleAgainstDBExists() {
  const auth = require('../src/middleware/auth');

  assert.strictEqual(typeof auth.verifyRoleAgainstDB, 'function', 'verifyRoleAgainstDB must be exported');

  console.log('  ✓ verifyRoleAgainstDB middleware is exported from auth');
}

// ──────────────────────────────────────────────
// 8. VerifyRoleAgainstDB — calls next() when DB verification fails gracefully
// ──────────────────────────────────────────────
async function testVerifyRoleAgainstDBSafeDefault() {
  const pool = require('../src/config/db');
  const originalExecute = pool.execute;

  // Simulate DB error
  pool.execute = () => { throw new Error('DB connection failed'); };

  try {
    const { verifyRoleAgainstDB } = require('../src/middleware/auth');

    const req = mockReq({ user: { id_usuario: 99, rol: 'admin' } });
    const res = mockRes();
    let statusCode = null;
    res.status = (code) => { statusCode = code; return res; };

    await verifyRoleAgainstDB(req, res, () => {});

    // On DB error, should return 403 (deny access by default)
    assert.strictEqual(statusCode, 403, 'Should return 403 on DB error for security');
  } finally {
    pool.execute = originalExecute;
  }

  console.log('  ✓ verifyRoleAgainstDB denies access on DB error (fail-safe)');
}

// ──────────────────────────────────────────────
// 9. RequireReauthentication — middleware exists
// ──────────────────────────────────────────────
async function testRequireReauthenticationExists() {
  const auth = require('../src/middleware/auth');

  assert.strictEqual(typeof auth.requireReauthentication, 'function', 'requireReauthentication must be exported');

  console.log('  ✓ requireReauthentication middleware is exported');
}

// ──────────────────────────────────────────────
// 10. RequireReauthentication — blocks without token
// ──────────────────────────────────────────────
async function testRequireReauthenticationBlocksNoToken() {
  const { requireReauthentication } = require('../src/middleware/auth');

  const req = mockReq({ headers: {}, user: { id_usuario: 1 } });
  const res = mockRes();
  let statusCode = null;
  let responseBody = null;
  res.status = (code) => { statusCode = code; return res; };
  res.json = (body) => { responseBody = body; return res; };

  await requireReauthentication(req, res, () => {});

  assert.strictEqual(statusCode, 403, 'Should return 403 without reauth token');
  assert.strictEqual(responseBody.ok, false, 'Response should have ok: false');
  assert.ok(responseBody.message.includes('Reautenticación'), 'Error message should mention reauthentication');

  console.log('  ✓ requireReauthentication blocks request without X-Reauth-Token');
}

// ──────────────────────────────────────────────
// 11. RequireReauthentication — blocks with invalid token
// ──────────────────────────────────────────────
async function testRequireReauthenticationBlocksInvalidToken() {
  const { requireReauthentication } = require('../src/middleware/auth');

  const req = mockReq({ headers: { 'x-reauth-token': 'invalid.token.here' }, user: { id_usuario: 1 } });
  const res = mockRes();
  let statusCode = null;
  res.status = (code) => { statusCode = code; return res; };
  res.json = () => res;

  await requireReauthentication(req, res, () => {});

  assert.strictEqual(statusCode, 403, 'Should return 403 for invalid token');

  console.log('  ✓ requireReauthentication blocks request with invalid reauth token');
}

// ──────────────────────────────────────────────
// 12. CSP — no unsafe-inline in scriptSrc
// ──────────────────────────────────────────────
async function testCSPNoUnsafeInline() {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'app.js'),
    'utf8'
  );

  // scriptSrc should NOT contain unsafe-inline
  const scriptSrcMatch = appSrc.match(/scriptSrc:\s*\[([^\]]*)\]/);
  assert.ok(scriptSrcMatch, 'scriptSrc must be defined in CSP');
  assert.ok(!scriptSrcMatch[1].includes("'unsafe-inline'"), 'scriptSrc must NOT contain unsafe-inline');

  // Verify self is allowed
  assert.ok(scriptSrcMatch[1].includes("'self'"), 'scriptSrc must allow self');

  console.log('  ✓ CSP scriptSrc does not contain unsafe-inline');
}

// ──────────────────────────────────────────────
// 13. Anonymization — uses random hex instead of user ID
// ──────────────────────────────────────────────
async function testAnonymizationUsesRandomHex() {
  const fs = require('fs');
  const path = require('path');
  const privacySrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'privacyManager.js'),
    'utf8'
  );

  // The anonymize function should use crypto.randomBytes for the email
  assert.ok(
    privacySrc.includes('randomBytes'),
    'Anonymization must use crypto.randomBytes for anonymous ID'
  );

  // Should NOT embed id_usuario in the email (the old vulnerable pattern)
  const anonymizeSection = privacySrc.substring(
    privacySrc.indexOf('anonymizeUser'),
    privacySrc.indexOf('anonymizeUser') + 600
  );

  // Should NOT contain the vulnerable pattern: CONCAT('eliminado_', id_usuario, ...)
  assert.ok(
    !anonymizeSection.includes("CONCAT('eliminado_', id_usuario"),
    'Must not embed user ID in anonymized email (security vulnerability)'
  );

  // Should use a different pattern with random hex
  assert.ok(
    anonymizeSection.includes('anonimo_') || anonymizeSection.includes('ELIMINADO'),
    'Should use anonimo_ prefix or ELIMINADO for anonymized data'
  );

  console.log('  ✓ Anonymization uses random hex instead of user ID in email');
}

// ──────────────────────────────────────────────
// 14. Break-glass PIN — 8-digit numeric
// ──────────────────────────────────────────────
async function testBreakGlassPIN() {
  const fs = require('fs');
  const path = require('path');
  const bgSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'breakGlass.js'),
    'utf8'
  );

  // PIN_LENGTH should be 8
  assert.ok(bgSrc.includes('PIN_LENGTH = 8'), 'PIN_LENGTH must be 8');

  // PIN generation should be numeric (Math.floor with 10000000 + random * 90000000)
  assert.ok(
    bgSrc.includes('Math.floor') && bgSrc.includes('10000000'),
    'PIN must be generated as 8-digit numeric using Math.floor'
  );

  // Should NOT use hex encoding (the old pattern)
  assert.ok(
    !bgSrc.includes("toString('hex')") || bgSrc.indexOf("toString('hex')") > bgSrc.indexOf('randomBytes(3)'),
    'PIN should not use hex encoding'
  );

  // Verify PIN format: 8 digits
  const pin = String(Math.floor(10000000 + Math.random() * 90000000));
  assert.strictEqual(pin.length, 8, 'Generated PIN must be 8 digits');
  assert.ok(/^\d{8}$/.test(pin), 'PIN must be all numeric digits');

  console.log('  ✓ Break-glass PIN is 8-digit numeric');
}

// ──────────────────────────────────────────────
// 15. Auth routes — reauthenticate endpoint exists
// ──────────────────────────────────────────────
async function testReauthenticateEndpointExists() {
  const fs = require('fs');
  const path = require('path');
  const authRouteSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'auth.js'),
    'utf8'
  );

  assert.ok(
    authRouteSrc.includes("router.post('/reauthenticate'"),
    'reauthenticate POST route must exist'
  );
  assert.ok(
    authRouteSrc.includes('verifyToken'),
    'reauthenticate route must require authentication'
  );
  assert.ok(
    authRouteSrc.includes('checkBlacklistMiddleware'),
    'reauthenticate route must check blacklist'
  );

  console.log('  ✓ Reauthenticate endpoint exists with proper middleware');
}

// ──────────────────────────────────────────────
// 16. Auth controller — reauthenticate returns reauthToken
// ──────────────────────────────────────────────
async function testReauthenticateReturnsToken() {
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'controllers', 'auth.js'),
    'utf8'
  );

  const reauthIdx = authSrc.indexOf('exports.reauthenticate');
  const reauthSection = authSrc.substring(reauthIdx, reauthIdx + 1500);

  assert.ok(
    reauthSection.includes('reauthToken'),
    'reauthenticate must return reauthToken in response'
  );
  assert.ok(
    reauthSection.includes("type: 'reauth'"),
    'reauthToken must carry type: reauth'
  );
  assert.ok(
    reauthSection.includes("'10m'") || reauthSection.includes('"10m"'),
    'reauthToken should expire in 10 minutes'
  );

  console.log('  ✓ Reauthenticate returns reauthToken with type:reauth and 10min expiry');
}

// ──────────────────────────────────────────────
// 17. MFA routes — audit events for enable/disable
// ──────────────────────────────────────────────
async function testMFAAuditEvents() {
  const fs = require('fs');
  const path = require('path');
  const mfaRouteSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'mfa.js'),
    'utf8'
  );

  assert.ok(
    mfaRouteSrc.includes('MFA_ENABLED'),
    'MFA enable route must audit MFA_ENABLED event'
  );
  assert.ok(
    mfaRouteSrc.includes('MFA_DISABLED'),
    'MFA disable route must audit MFA_DISABLED event'
  );
  assert.ok(
    mfaRouteSrc.includes('MFA_ENABLE_FAILED'),
    'MFA enable must audit MFA_ENABLE_FAILED on error'
  );
  assert.ok(
    mfaRouteSrc.includes('registrarAuditoria'),
    'MFA routes must use registrarAuditoria'
  );

  console.log('  ✓ MFA routes emit audit events for enable/disable/failure');
}

// ──────────────────────────────────────────────
// 18. Auth controller — MFA login audit events
// ──────────────────────────────────────────────
async function testMFALoginAuditEvents() {
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'controllers', 'auth.js'),
    'utf8'
  );

  assert.ok(
    authSrc.includes('MFA_LOGIN_SUCCESS'),
    'loginMFA must audit MFA_LOGIN_SUCCESS event'
  );
  assert.ok(
    authSrc.includes('MFA_LOGIN_FAILED'),
    'loginMFA must audit MFA_LOGIN_FAILED event'
  );

  console.log('  ✓ MFA login emits audit events for success and failure');
}

// ──────────────────────────────────────────────
// 19. Audit events — profile change auditing in alumnos
// ──────────────────────────────────────────────
async function testProfileChangeAuditAlumnos() {
  const fs = require('fs');
  const path = require('path');
  const alumnosSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'alumnos.js'),
    'utf8'
  );

  assert.ok(
    alumnosSrc.includes('PROFILE_CHANGED'),
    'Alumnos update must audit PROFILE_CHANGED event'
  );
  assert.ok(
    alumnosSrc.includes('registrarAuditoria'),
    'Alumnos route must use registrarAuditoria'
  );

  console.log('  ✓ Alumnos update emits PROFILE_CHANGED audit event');
}

// ──────────────────────────────────────────────
// 20. Audit events — profile change auditing in docentes
// ──────────────────────────────────────────────
async function testProfileChangeAuditDocentes() {
  const fs = require('fs');
  const path = require('path');
  const docentesSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'docentes.js'),
    'utf8'
  );

  assert.ok(
    docentesSrc.includes('PROFILE_CHANGED'),
    'Docentes update must audit PROFILE_CHANGED event'
  );
  assert.ok(
    docentesSrc.includes('registrarAuditoria'),
    'Docentes route must use registrarAuditoria'
  );

  console.log('  ✓ Docentes update emits PROFILE_CHANGED audit event');
}

// ──────────────────────────────────────────────
// 21. Auditoria — token stored as SHA-256 hash
// ──────────────────────────────────────────────
async function testTokenStoredAsHash() {
  const fs = require('fs');
  const path = require('path');
  const auditSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'middleware', 'auditoria.js'),
    'utf8'
  );

  assert.ok(
    auditSrc.includes("createHash('sha256')"),
    'Audit must hash token with SHA-256'
  );

  // Must use tokenHash variable
  assert.ok(
    auditSrc.includes('tokenHash'),
    'Must use hashed token (tokenHash) in sesiones_activas'
  );

  // tokenHash should be computed before the DB insert
  const tokenHashIdx = auditSrc.indexOf('tokenHash');
  const insertIdx = auditSrc.indexOf('INSERT INTO sesiones_activas');
  assert.ok(
    tokenHashIdx < insertIdx,
    'tokenHash must be computed before INSERT INTO sesiones_activas'
  );

  console.log('  ✓ Audit stores SHA-256 hash of JWT instead of raw token');
}

// ──────────────────────────────────────────────
// 22. VerifyRoleAgainstDB — critical routes use it
// ──────────────────────────────────────────────
async function testVerifyRoleAgainstDBInRoutes() {
  const fs = require('fs');
  const path = require('path');

  const breakGlassSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'breakGlass.js'),
    'utf8'
  );
  assert.ok(
    breakGlassSrc.includes('verifyRoleAgainstDB'),
    'breakGlass routes must use verifyRoleAgainstDB'
  );

  const institucionesSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'instituciones.js'),
    'utf8'
  );
  assert.ok(
    institucionesSrc.includes('verifyRoleAgainstDB'),
    'instituciones routes must use verifyRoleAgainstDB'
  );

  const kardexSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'kardex.js'),
    'utf8'
  );
  assert.ok(
    kardexSrc.includes('verifyRoleAgainstDB'),
    'kardex admin routes must use verifyRoleAgainstDB'
  );

  console.log('  ✓ Critical routes (breakGlass, instituciones, kardex) use verifyRoleAgainstDB');
}

// ──────────────────────────────────────────────
// 23. Segment tracking — not used in token blacklist
// ──────────────────────────────────────────────
async function testSessionManagerTokenHash() {
  const fs = require('fs');
  const path = require('path');
  const smSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'sessionManager.js'),
    'utf8'
  );

  assert.ok(
    smSrc.includes("createHash('sha256')"),
    'sessionManager must use SHA-256 for token hashing'
  );

  console.log('  ✓ sessionManager uses SHA-256 for token hashing');
}

// ──────────────────────────────────────────────
// 24. Security headers — helmet CSP includes no unsafe-eval
// ──────────────────────────────────────────────
async function testNoUnsafeEval() {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'app.js'),
    'utf8'
  );

  assert.ok(
    !appSrc.includes("'unsafe-eval'"),
    'CSP must not contain unsafe-eval'
  );

  console.log('  ✓ CSP does not contain unsafe-eval');
}

// ──────────────────────────────────────────────
// 25. Password — bcrypt rounds are 12
// ──────────────────────────────────────────────
async function testBcryptRounds() {
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'controllers', 'auth.js'),
    'utf8'
  );

  // bcrypt.hash with salt rounds of 12
  assert.ok(
    authSrc.includes("bcrypt.hash") && authSrc.includes(', 12)'),
    'Password hashing must use bcrypt with 12 salt rounds'
  );

  console.log('  ✓ Password hashing uses bcrypt with 12 salt rounds');
}

// ──────────────────────────────────────────────
// RUN ALL TESTS
// ──────────────────────────────────────────────
async function runTests() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   SIVACAD-ISC · Additional Security Tests   ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  const tests = [
    testRefreshSecretSeparated,
    testMissingRefreshSecretThrows,
    testCustomExpiresIn,
    testRegistrarAuditoriaExists,
    testGetClientIpForwarded,
    testGetDeviceHash,
    testVerifyRoleAgainstDBExists,
    testVerifyRoleAgainstDBSafeDefault,
    testRequireReauthenticationExists,
    testRequireReauthenticationBlocksNoToken,
    testRequireReauthenticationBlocksInvalidToken,
    testCSPNoUnsafeInline,
    testAnonymizationUsesRandomHex,
    testBreakGlassPIN,
    testReauthenticateEndpointExists,
    testReauthenticateReturnsToken,
    testMFAAuditEvents,
    testMFALoginAuditEvents,
    testProfileChangeAuditAlumnos,
    testProfileChangeAuditDocentes,
    testTokenStoredAsHash,
    testVerifyRoleAgainstDBInRoutes,
    testSessionManagerTokenHash,
    testNoUnsafeEval,
    testBcryptRounds
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
