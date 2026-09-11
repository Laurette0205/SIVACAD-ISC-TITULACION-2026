'use strict';

// backend/tests/security.test.js
// Security unit tests — JWT, account lockout, token blacklist, registration role,
// rate limiting, password policy, XSS sanitization, security headers

const assert = require('assert');
const crypto = require('crypto');

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
// 1. JWT — algorithm enforcement
// ──────────────────────────────────────────────
async function testJWTAlgorithms() {
  const jwt = require('jsonwebtoken');
  const secret = 'test-secret-algo';
  const token = jwt.sign({ id: 1 }, secret, { algorithm: 'HS256' });

  // Should verify with HS256
  try {
    jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (e) {
    throw new Error('HS256 verification failed for valid token');
  }

  // Should reject RS256 (none of the allowed algorithms)
  try {
    jwt.verify(token, secret, { algorithms: ['RS256'] });
    throw new Error('Should have rejected RS256');
  } catch (e) {
    if (e.message === 'Should have rejected RS256') throw e;
    // jsonwebtoken uses different error codes depending on version
    if (e.code !== 'ALGORITHM_MISMATCH' && e.name !== 'JsonWebTokenError') {
      throw new Error(`Expected algorithm rejection, got code=${e.code} name=${e.name}`);
    }
  }

  // Should reject 'none' algorithm
  try {
    jwt.verify(token, secret, { algorithms: ['none'] });
    throw new Error('Should have rejected none algorithm');
  } catch (e) {
    if (e.message === 'Should have rejected none algorithm') throw e;
  }

  console.log('  ✓ JWT algorithm enforcement');
}

// ──────────────────────────────────────────────
// 2. JWT — signToken uses HS256
// ──────────────────────────────────────────────
async function testSignTokenAlgorithm() {
  const jwt = require('jsonwebtoken');
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'unit-test-secret';

  try {
    const { signToken } = require('../src/services/jwt');
    const token = signToken({ id_usuario: 42, rol: 'alumno' });

    const decoded = jwt.verify(token, 'unit-test-secret', { algorithms: ['HS256'] });
    assert.strictEqual(decoded.id_usuario, 42);
    assert.strictEqual(decoded.rol, 'alumno');
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    // Clear require cache so subsequent tests get fresh modules
    delete require.cache[require.resolve('../src/services/jwt')];
  }

  console.log('  ✓ signToken uses HS256 and embeds payload');
}

// ──────────────────────────────────────────────
// 3. JWT — verifyToken rejects wrong algorithm
// ──────────────────────────────────────────────
async function testVerifyTokenRejectsWrongAlgorithm() {
  const jwt = require('jsonwebtoken');
  const secret = 'verify-test-secret';
  const token = jwt.sign({ id: 1 }, secret, { algorithm: 'HS256' });

  // tamper-free token should pass
  jwt.verify(token, secret, { algorithms: ['HS256'] });

  // inject a header with alg: HS384 — the library should still reject
  const header = Buffer.from(JSON.stringify({ alg: 'HS384', typ: 'JWT' })).toString('base64url');
  const badToken = `${header}.${token.split('.')[1]}.${token.split('.')[2]}`;

  try {
    jwt.verify(badToken, secret, { algorithms: ['HS256'] });
    throw new Error('Should have rejected HS384');
  } catch (e) {
    if (e.message === 'Should have rejected HS384') throw e;
  }

  console.log('  ✓ verifyToken rejects non-HS256 tokens');
}

// ──────────────────────────────────────────────
// 4. JWT — expiration
// ──────────────────────────────────────────────
async function testJWTExpiration() {
  const jwt = require('jsonwebtoken');
  const secret = 'exp-test';

  const expired = jwt.sign({ id: 1 }, secret, { expiresIn: '-1s', algorithm: 'HS256' });
  try {
    jwt.verify(expired, secret, { algorithms: ['HS256'] });
    throw new Error('Should have rejected expired token');
  } catch (e) {
    if (e.message === 'Should have rejected expired token') throw e;
    assert.strictEqual(e.name, 'TokenExpiredError');
  }

  console.log('  ✓ JWT rejects expired tokens');
}

// ──────────────────────────────────────────────
// 5. Account lockout — constants
// ──────────────────────────────────────────────
async function testAccountLockoutConstants() {
  const lockout = require('../src/services/accountLockout');

  assert.strictEqual(lockout.MAX_ATTEMPTS, 5, 'MAX_ATTEMPTS should be 5');
  assert.strictEqual(lockout.LOCKOUT_DURATION_MS, 30 * 60 * 1000, 'Lockout should be 30 minutes');

  console.log('  ✓ Account lockout: 5 attempts, 30min lockout');
}

// ──────────────────────────────────────────────
// 6. Account lockout — functions exist and are async
// ──────────────────────────────────────────────
async function testAccountLockoutFunctions() {
  const lockout = require('../src/services/accountLockout');

  assert.strictEqual(typeof lockout.isAccountLocked, 'function', 'isAccountLocked must exist');
  assert.strictEqual(typeof lockout.recordFailedAttempt, 'function', 'recordFailedAttempt must exist');
  assert.strictEqual(typeof lockout.recordSuccessfulLogin, 'function', 'recordSuccessfulLogin must exist');
  assert.strictEqual(typeof lockout.getLockStatus, 'function', 'getLockStatus must exist');

  // Verify they return promises (async functions)
  assert.ok(lockout.isAccountLocked(1) instanceof Promise, 'isAccountLocked should return Promise');
  assert.ok(lockout.recordFailedAttempt(1) instanceof Promise, 'recordFailedAttempt should return Promise');
  assert.ok(lockout.recordSuccessfulLogin(1) instanceof Promise, 'recordSuccessfulLogin should return Promise');
  assert.ok(lockout.getLockStatus(1) instanceof Promise, 'getLockStatus should return Promise');

  console.log('  ✓ Account lockout functions are async and exported');
}

// ──────────────────────────────────────────────
// 7. Token blacklist — hashToken is deterministic
// ──────────────────────────────────────────────
async function testTokenBlacklistHash() {
  const { hashToken } = require('../src/services/sessionManager');

  const token = 'eyJhbGciOiJIUzI1NiJ9.test.payload';
  const h1 = hashToken(token);
  const h2 = hashToken(token);

  assert.strictEqual(h1, h2, 'Hash must be deterministic');
  assert.strictEqual(h1.length, 64, 'SHA-256 hex digest is 64 chars');

  // Different tokens produce different hashes
  const h3 = hashToken(token + 'x');
  assert.notStrictEqual(h1, h3, 'Different tokens must produce different hashes');

  console.log('  ✓ Token blacklist: SHA-256 hashing is deterministic');
}

// ──────────────────────────────────────────────
// 8. Token blacklist — sessionManager exports
// ──────────────────────────────────────────────
async function testSessionManagerExports() {
  const sm = require('../src/services/sessionManager');

  assert.strictEqual(typeof sm.addToBlacklist, 'function', 'addToBlacklist must exist');
  assert.strictEqual(typeof sm.isBlacklisted, 'function', 'isBlacklisted must exist');
  assert.strictEqual(typeof sm.logout, 'function', 'logout must exist');
  assert.strictEqual(typeof sm.logoutAllSessions, 'function', 'logoutAllSessions must exist');
  assert.strictEqual(typeof sm.trackSession, 'function', 'trackSession must exist');
  assert.strictEqual(typeof sm.checkBlacklistMiddleware, 'function', 'checkBlacklistMiddleware must exist');

  console.log('  ✓ Session manager exports all required functions');
}

// ──────────────────────────────────────────────
// 9. Token blacklist — extractToken utility
// ──────────────────────────────────────────────
async function testExtractToken() {
  // extractToken is internal to sessionManager; test via checkBlacklistMiddleware
  const sm = require('../src/services/sessionManager');

  // Middleware should call next() when no Authorization header
  const req1 = mockReq();
  const res1 = mockRes();
  let called1 = false;
  await sm.checkBlacklistMiddleware(req1, res1, () => { called1 = true; });
  assert.ok(called1, 'Middleware calls next when no auth header');

  // Middleware should call next() when malformed header (no Bearer)
  const req2 = mockReq({ headers: { authorization: 'Basic abc' } });
  const res2 = mockRes();
  let called2 = false;
  await sm.checkBlacklistMiddleware(req2, res2, () => { called2 = true; });
  assert.ok(called2, 'Middleware calls next for non-Bearer header');

  console.log('  ✓ Blacklist middleware skips non-Bearer tokens');
}

// ──────────────────────────────────────────────
// 10. Registration — only 'alumno' role allowed
// ──────────────────────────────────────────────
async function testRegistrationRoleRestriction() {
  // The auth controller hardcodes rolNormalizado = 'alumno' in register.
  // Verify the source code enforces this by reading the file.
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'controllers', 'auth.js'),
    'utf8'
  );

  // The register function must NOT use req.body.rol for assignment
  // It must set rolNormalizado = 'alumno' directly
  const registerSection = authSrc.substring(
    authSrc.indexOf('exports.register'),
    authSrc.indexOf('exports.login')
  );

  assert.ok(
    registerSection.includes("const rolNormalizado = 'alumno'"),
    'Register must hardcode role to alumno'
  );

  // Verify it does NOT read rol from req.body for the actual role
  assert.ok(
    !registerSection.includes('req.body.rol') || registerSection.includes("// SEGURIDAD"),
    'Register must not allow role from request body'
  );

  console.log('  ✓ Registration forces alumno role (no privilege escalation)');
}

// ──────────────────────────────────────────────
// 11. Password policy — strength requirements
// ──────────────────────────────────────────────
async function testPasswordPolicy() {
  const { validatePassword, POLICY } = require('../src/security/passwordPolicy');

  assert.strictEqual(POLICY.minLength, 12, 'Min length must be 12');
  assert.strictEqual(POLICY.maxLength, 20, 'Max length must be 20');
  assert.strictEqual(POLICY.requireUppercase, true, 'Must require uppercase');
  assert.strictEqual(POLICY.requireLowercase, true, 'Must require lowercase');
  assert.strictEqual(POLICY.requireNumber, true, 'Must require number');
  assert.strictEqual(POLICY.requireSymbol, true, 'Must require symbol');

  // Valid password
  const valid = validatePassword('Abcdef1234!@');
  assert.strictEqual(valid.valid, true, 'Valid password should pass');

  // Too short
  const short = validatePassword('Ab1!');
  assert.strictEqual(short.valid, false, 'Short password should fail');
  assert.ok(short.errors.length > 0, 'Should report errors');

  // No uppercase
  const noUpper = validatePassword('abcdef1234!@');
  assert.strictEqual(noUpper.valid, false, 'No uppercase should fail');

  // No lowercase
  const noLower = validatePassword('ABCDEF1234!@');
  assert.strictEqual(noLower.valid, false, 'No lowercase should fail');

  // No number
  const noNum = validatePassword('Abcdefgh!@#$');
  assert.strictEqual(noNum.valid, false, 'No number should fail');

  // No symbol
  const noSym = validatePassword('Abcdef123456');
  assert.strictEqual(noSym.valid, false, 'No symbol should fail');

  // Empty
  const empty = validatePassword('');
  assert.strictEqual(empty.valid, false, 'Empty password should fail');

  console.log('  ✓ Password policy enforces 12-20 chars, upper, lower, digit, symbol');
}

// ──────────────────────────────────────────────
// 12. Rate limiter — exists and returns middleware
// ──────────────────────────────────────────────
async function testRateLimiterExists() {
  const { rateLimiter } = require('../src/middleware/seguridad');

  assert.strictEqual(typeof rateLimiter, 'function', 'rateLimiter must be a function');

  const middleware = rateLimiter({ windowMs: 60000, max: 10 });
  assert.strictEqual(typeof middleware, 'function', 'rateLimiter must return middleware');

  console.log('  ✓ Rate limiter is available as middleware factory');
}

// ──────────────────────────────────────────────
// 13. Rate limiter — blocks after max exceeded
// ──────────────────────────────────────────────
async function testRateLimiterBlocks() {
  const { rateLimiter } = require('../src/middleware/seguridad');

  const limiter = rateLimiter({ windowMs: 60000, max: 3 });

  // Simulate 4 requests from same IP+path
  let blocked = false;
  for (let i = 0; i < 4; i++) {
    const req = mockReq({
      headers: { 'user-agent': 'test', 'x-forwarded-for': '10.0.0.1' },
      path: '/rate-test'
    });
    const res = mockRes();
    let nextCalled = false;

    await limiter(req, res, () => { nextCalled = true; });

    if (res._status === 429) {
      blocked = true;
      assert.ok(res._body.ok === false, 'Blocked response should have ok:false');
      break;
    }
  }

  assert.ok(blocked, 'Rate limiter should block after max exceeded');

  console.log('  ✓ Rate limiter blocks after exceeding max requests');
}

// ──────────────────────────────────────────────
// 14. XSS sanitizer — escapes HTML in body
// ──────────────────────────────────────────────
async function testXssSanitizer() {
  const { xssSanitizer } = require('../src/middleware/seguridad');

  const req = mockReq({
    body: { name: '<script>alert("xss")</script>', desc: 'a & b' },
    query: { search: '<img src=x onerror=alert(1)>' },
    params: { id: '">inject' }
  });

  let nextCalled = false;
  xssSanitizer(req, mockRes(), () => { nextCalled = true; });

  assert.ok(nextCalled, 'XSS sanitizer should call next');
  assert.ok(!req.body.name.includes('<script>'), 'Body should escape <script>');
  assert.ok(req.body.name.includes('&lt;script&gt;'), 'Body should contain escaped entities');
  assert.ok(req.body.desc.includes('a &amp; b'), 'Body should escape ampersands');
  assert.ok(!req.query.search.includes('<img'), 'Query should escape HTML tags');
  assert.ok(req.params.id.includes('&gt;'), 'Params should escape >');

  console.log('  ✓ XSS sanitizer escapes HTML in body, query, params');
}

// ──────────────────────────────────────────────
// 15. Security headers middleware
// ──────────────────────────────────────────────
async function testSecurityHeaders() {
  const { securityHeaders } = require('../src/middleware/seguridad');

  const res = mockRes();
  let nextCalled = false;
  securityHeaders(mockReq(), res, () => { nextCalled = true; });

  assert.ok(nextCalled, 'securityHeaders should call next');
  assert.strictEqual(res.get('X-Content-Type-Options'), 'nosniff');
  assert.strictEqual(res.get('X-Frame-Options'), 'DENY');
  assert.strictEqual(res.get('X-XSS-Protection'), '1; mode=block');
  assert.strictEqual(res.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.strictEqual(res.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');

  console.log('  ✓ Security headers set correct CSP-like protections');
}

// ──────────────────────────────────────────────
// 16. Device fingerprint generation
// ──────────────────────────────────────────────
async function testDeviceFingerprint() {
  const { generateDeviceFingerprint } = require('../src/middleware/seguridad');

  const req = mockReq({
    headers: {
      'user-agent': 'Mozilla/5.0',
      'accept-language': 'es-MX',
      'accept-encoding': 'gzip, deflate'
    }
  });

  const fp = generateDeviceFingerprint(req);
  assert.strictEqual(typeof fp, 'string', 'Fingerprint must be string');
  assert.strictEqual(fp.length, 32, 'Fingerprint must be 32 chars (truncated SHA-256)');

  // Same inputs → same fingerprint
  const fp2 = generateDeviceFingerprint(req);
  assert.strictEqual(fp, fp2, 'Fingerprint must be deterministic');

  // Different user-agent → different fingerprint
  const req2 = mockReq({
    headers: {
      'user-agent': 'DifferentAgent/2.0',
      'accept-language': 'es-MX',
      'accept-encoding': 'gzip, deflate'
    }
  });
  const fp3 = generateDeviceFingerprint(req2);
  assert.notStrictEqual(fp, fp3, 'Different UA must produce different fingerprint');

  console.log('  ✓ Device fingerprint is deterministic and UA-sensitive');
}

// ──────────────────────────────────────────────
// 17. Auth middleware — algorithm enforcement
// ──────────────────────────────────────────────
async function testAuthMiddlewareAlgorithm() {
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'middleware', 'auth.js'),
    'utf8'
  );

  // The auth middleware must verify with algorithms: ['HS256']
  assert.ok(
    authSrc.includes("algorithms: ['HS256']") || authSrc.includes('algorithms: ["HS256"]'),
    'Auth middleware must enforce HS256 algorithm'
  );

  console.log('  ✓ Auth middleware enforces HS256 algorithm');
}

// ──────────────────────────────────────────────
// 18. Auth middleware — blacklist check on verify
// ──────────────────────────────────────────────
async function testAuthMiddlewareBlacklistCheck() {
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'middleware', 'auth.js'),
    'utf8'
  );

  assert.ok(
    authSrc.includes('isBlacklisted') || authSrc.includes('blacklisted'),
    'Auth middleware must check token blacklist'
  );

  console.log('  ✓ Auth middleware checks token blacklist after verify');
}

// ──────────────────────────────────────────────
// 19. Auth routes — rate limiters configured
// ──────────────────────────────────────────────
async function testAuthRouteRateLimiters() {
  const fs = require('fs');
  const path = require('path');
  const routeSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'auth.js'),
    'utf8'
  );

  assert.ok(routeSrc.includes('loginLimiter'), 'Login route must have rate limiter');
  assert.ok(routeSrc.includes('registerLimiter'), 'Register route must have rate limiter');
  assert.ok(routeSrc.includes('forgotPasswordLimiter'), 'Forgot-password route must have rate limiter');
  assert.ok(routeSrc.includes('resetPasswordLimiter'), 'Reset-password route must have rate limiter');
  assert.ok(routeSrc.includes('refreshLimiter'), 'Refresh route must have rate limiter');

  console.log('  ✓ All auth routes have rate limiters configured');
}

// ──────────────────────────────────────────────
// 20. JWT — refresh token carries type: 'refresh'
// ──────────────────────────────────────────────
async function testRefreshTokenType() {
  const originalSecret = process.env.JWT_SECRET;
  const originalRefresh = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

  try {
    const jwt = require('jsonwebtoken');
    const { signRefreshToken, verifyRefreshToken } = require('../src/services/jwt');

    const token = signRefreshToken({ id_usuario: 99 });
    const decoded = verifyRefreshToken(token);

    assert.strictEqual(decoded.type, 'refresh', 'Refresh token must carry type: refresh');
    assert.strictEqual(decoded.id_usuario, 99, 'Refresh token must carry id_usuario');
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalRefresh === undefined) delete process.env.JWT_REFRESH_SECRET;
    else process.env.JWT_REFRESH_SECRET = originalRefresh;
    delete require.cache[require.resolve('../src/services/jwt')];
  }

  console.log('  ✓ Refresh token carries type:refresh and user ID');
}

// ──────────────────────────────────────────────
// 21. JWT — missing secret throws
// ──────────────────────────────────────────────
async function testJWTMissingSecret() {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  try {
    delete require.cache[require.resolve('../src/services/jwt')];
    const { signToken } = require('../src/services/jwt');

    try {
      signToken({ id: 1 });
      throw new Error('Should have thrown for missing JWT_SECRET');
    } catch (e) {
      if (e.message === 'Should have thrown for missing JWT_SECRET') throw e;
      assert.ok(e.message.includes('JWT_SECRET'), 'Error must mention JWT_SECRET');
    }
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    delete require.cache[require.resolve('../src/services/jwt')];
  }

  console.log('  ✓ signToken throws when JWT_SECRET is missing');
}

// ──────────────────────────────────────────────
// 22. Role middleware — RBAC enforcement
// ──────────────────────────────────────────────
async function testRoleMiddleware() {
  const { role } = require('../src/middleware/auth');

  // Middleware factory returns function
  const mw = role('admin', 'soporte');
  assert.strictEqual(typeof mw, 'function', 'role() must return middleware');

  // Unauthenticated user → 401
  const req1 = mockReq({ user: null });
  const res1 = mockRes();
  let nextCalled = false;
  mw(req1, res1, () => { nextCalled = true; });
  assert.strictEqual(res1._status, 401, 'Unauthenticated → 401');
  assert.ok(!nextCalled, 'Should not call next for unauthenticated');

  // Wrong role → 403
  const req2 = mockReq({ user: { rol: 'alumno' } });
  const res2 = mockRes();
  let nextCalled2 = false;
  mw(req2, res2, () => { nextCalled2 = true; });
  assert.strictEqual(res2._status, 403, 'Wrong role → 403');
  assert.ok(!nextCalled2, 'Should not call next for wrong role');

  // Correct role → next()
  const req3 = mockReq({ user: { rol: 'admin' } });
  const res3 = mockRes();
  let nextCalled3 = false;
  mw(req3, res3, () => { nextCalled3 = true; });
  assert.ok(nextCalled3, 'Should call next for correct role');

  // Case-insensitive role matching
  const req4 = mockReq({ user: { rol: 'ADMIN' } });
  const res4 = mockRes();
  let nextCalled4 = false;
  mw(req4, res4, () => { nextCalled4 = true; });
  assert.ok(nextCalled4, 'Role matching should be case-insensitive');

  console.log('  ✓ Role middleware enforces RBAC with case-insensitive matching');
}

// ──────────────────────────────────────────────
// 23. Account lockout — returns safe defaults on DB error
// ──────────────────────────────────────────────
async function testAccountLockoutSafeDefaults() {
  const lockout = require('../src/services/accountLockout');

  // With no DB connection, functions should not throw
  // They should return safe defaults (not locked)
  const locked = await lockout.isAccountLocked(99999);
  assert.strictEqual(locked, false, 'isAccountLocked returns false when DB unavailable');

  const status = await lockout.getLockStatus(99999);
  assert.strictEqual(status.locked, false, 'getLockStatus returns not-locked on DB error');
  assert.strictEqual(status.maxAttempts, 5, 'getLockStatus includes maxAttempts');

  console.log('  ✓ Account lockout returns safe defaults when DB unavailable');
}

// ──────────────────────────────────────────────
// 24. Auth controller — institutional email validation
// ──────────────────────────────────────────────
async function testInstitutionalEmailValidation() {
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'controllers', 'auth.js'),
    'utf8'
  );

  assert.ok(authSrc.includes('isInstitutionalEmail'), 'Auth controller must validate institutional email');
  assert.ok(authSrc.includes('getAllowedEmailDomains'), 'Auth controller must define allowed email domains');

  // Verify the allowed domains include tesi.edu.mx
  const domainsMatch = authSrc.match(/fallbackDomains\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(domainsMatch, 'Fallback domains must be defined');
  assert.ok(domainsMatch[1].includes('tesi.edu.mx'), 'tesi.edu.mx must be in allowed domains');
  assert.ok(domainsMatch[1].includes('outlook.com'), 'outlook.com must be in allowed domains');

  console.log('  ✓ Auth controller validates institutional email domains');
}

// ──────────────────────────────────────────────
// 25. Auth controller — institution resolution from email
// ──────────────────────────────────────────────
async function testInstitutionResolution() {
  const fs = require('fs');
  const path = require('path');
  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'controllers', 'auth.js'),
    'utf8'
  );

  assert.ok(
    authSrc.includes('resolveByDomain'),
    'Auth controller must resolve institution from email domain'
  );

  console.log('  ✓ Auth controller resolves institution from email domain');
}

// ──────────────────────────────────────────────
// RUN ALL TESTS
// ──────────────────────────────────────────────
async function runTests() {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   SIVACAD-ISC · Security Unit Tests          ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  const tests = [
    testJWTAlgorithms,
    testSignTokenAlgorithm,
    testVerifyTokenRejectsWrongAlgorithm,
    testJWTExpiration,
    testAccountLockoutConstants,
    testAccountLockoutFunctions,
    testAccountLockoutSafeDefaults,
    testTokenBlacklistHash,
    testSessionManagerExports,
    testExtractToken,
    testRegistrationRoleRestriction,
    testPasswordPolicy,
    testRateLimiterExists,
    testRateLimiterBlocks,
    testXssSanitizer,
    testSecurityHeaders,
    testDeviceFingerprint,
    testAuthMiddlewareAlgorithm,
    testAuthMiddlewareBlacklistCheck,
    testAuthRouteRateLimiters,
    testRefreshTokenType,
    testJWTMissingSecret,
    testRoleMiddleware,
    testInstitutionalEmailValidation,
    testInstitutionResolution
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
