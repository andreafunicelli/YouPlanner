import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../index.mjs';
import { resetState } from '../store.mjs';

async function withServer(fn) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const { port } = server.address();
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
}

async function json(base, path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await res.json();
  return { status: res.status, payload };
}

async function login(base, email) {
  const res = await json(base, '/api/login', { method: 'POST', body: { email, password: 'demo123' } });
  assert.equal(res.status, 200);
  return res.payload.token;
}

test('API auth and role authorization are enforced consistently', async () => {
  await resetState();
  await withServer(async (base) => {
    const managerToken = await login(base, 'manager@peopleplanner.local');
    const employeeToken = await login(base, 'employee@peopleplanner.local');
    const superToken = await login(base, 'superadmin@peopleplanner.local');

    const unauth = await json(base, '/api/bootstrap');
    assert.equal(unauth.status, 401);
    assert.equal(unauth.payload.error, 'AUTH_REQUIRED');

    const employeeDecision = await json(base, '/api/requests/r1/decision', {
      token: employeeToken,
      method: 'POST',
      body: { decision: 'approved' },
    });
    assert.equal(employeeDecision.status, 403);
    assert.equal(employeeDecision.payload.error, 'ADMIN_ONLY');

    const superDecision = await json(base, '/api/requests/r1/decision', {
      token: superToken,
      method: 'POST',
      body: { decision: 'approved' },
    });
    assert.equal(superDecision.status, 403);
    assert.equal(superDecision.payload.error, 'ADMIN_ONLY');

    const managerDecision = await json(base, '/api/requests/r1/decision', {
      token: managerToken,
      method: 'POST',
      body: { decision: 'approved' },
    });
    assert.equal(managerDecision.status, 200);
    assert.equal(managerDecision.payload.request.status, 'approved');
  });
});

test('manager scope blocks operational writes outside assigned BU', async () => {
  await resetState();
  await withServer(async (base) => {
    const managerToken = await login(base, 'manager@peopleplanner.local');
    const outsideAssignment = await json(base, '/api/assignments', {
      token: managerToken,
      method: 'POST',
      body: { empId: 'e8', date: '2026-06-10', entries: [{ type: 'turno', time: '09:00–18:00' }] },
    });
    assert.equal(outsideAssignment.status, 403);
    assert.equal(outsideAssignment.payload.error, 'FORBIDDEN');
  });
});

test('manager without BU receives an empty operational bootstrap', async () => {
  await resetState();
  await withServer(async (base) => {
    const token = await login(base, 'manager-empty@peopleplanner.local');
    const res = await json(base, '/api/bootstrap', { token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.people, []);
    assert.deepEqual(res.payload.bus, []);
    assert.deepEqual(res.payload.requests, []);
    assert.deepEqual(res.payload.oncall, []);
    assert.deepEqual(res.payload.shifts, []);
  });
});

test('global tweaks are Super Admin only and personal tweaks stay user-scoped', async () => {
  await resetState();
  await withServer(async (base) => {
    const superToken = await login(base, 'superadmin@peopleplanner.local');
    const managerToken = await login(base, 'manager@peopleplanner.local');
    const emptyManagerToken = await login(base, 'manager-empty@peopleplanner.local');
    const employeeToken = await login(base, 'employee@peopleplanner.local');

    const forbiddenGlobal = await json(base, '/api/tweaks/global', {
      token: managerToken,
      method: 'PATCH',
      body: { densita: 'compatta' },
    });
    assert.equal(forbiddenGlobal.status, 403);
    assert.equal(forbiddenGlobal.payload.error, 'SUPERADMIN_ONLY');

    const updatedGlobal = await json(base, '/api/tweaks/global', {
      token: superToken,
      method: 'PATCH',
      body: { densita: 'comoda' },
    });
    assert.equal(updatedGlobal.status, 200);
    assert.equal(updatedGlobal.payload.globalTweaks.densita, 'comoda');

    const forbiddenGlobalThreshold = await json(base, '/api/tweaks/global', {
      token: superToken,
      method: 'PATCH',
      body: { sogliaAssenti: 4 },
    });
    assert.equal(forbiddenGlobalThreshold.status, 400);

    const updatedPersonal = await json(base, '/api/tweaks/me', {
      token: employeeToken,
      method: 'PATCH',
      body: { densita: 'compatta', vista: 'mese' },
    });
    assert.equal(updatedPersonal.status, 200);
    assert.deepEqual(updatedPersonal.payload.userTweaks, { densita: 'compatta', vista: 'mese' });

    const employeeBootstrap = await json(base, '/api/bootstrap', { token: employeeToken });
    const managerBootstrap = await json(base, '/api/bootstrap', { token: managerToken });
    assert.equal(employeeBootstrap.payload.globalTweaks.densita, 'comoda');
    assert.equal(employeeBootstrap.payload.user.tweaks.densita, 'compatta');
    assert.deepEqual(managerBootstrap.payload.user.tweaks, {});

    const forbiddenEmployeeThreshold = await json(base, '/api/tweaks/me', {
      token: employeeToken,
      method: 'PATCH',
      body: { sogliaRemote: 4 },
    });
    assert.equal(forbiddenEmployeeThreshold.status, 403);
    assert.equal(forbiddenEmployeeThreshold.payload.error, 'BU_MANAGER_ONLY');

    const forbiddenEmptyManagerThreshold = await json(base, '/api/tweaks/me', {
      token: emptyManagerToken,
      method: 'PATCH',
      body: { sogliaAssenti: 4 },
    });
    assert.equal(forbiddenEmptyManagerThreshold.status, 403);

    const managerThreshold = await json(base, '/api/tweaks/me', {
      token: managerToken,
      method: 'PATCH',
      body: { sogliaAssenti: 4, sogliaRemote: 5 },
    });
    assert.equal(managerThreshold.status, 200);
    assert.equal(managerThreshold.payload.userTweaks.sogliaAssenti, 4);
    assert.equal(managerThreshold.payload.userTweaks.sogliaRemote, 5);

    const invalid = await json(base, '/api/tweaks/me', {
      token: employeeToken,
      method: 'PATCH',
      body: { densita: 'gigante' },
    });
    assert.equal(invalid.status, 400);

    const reset = await json(base, '/api/tweaks/me', { token: employeeToken, method: 'DELETE' });
    assert.equal(reset.status, 200);
    assert.deepEqual(reset.payload.userTweaks, {});
  });
});

test('backend validates bad payloads and blocks absence/on-call conflicts', async () => {
  await resetState();
  await withServer(async (base) => {
    const managerToken = await login(base, 'manager@peopleplanner.local');
    const badAssignment = await json(base, '/api/assignments', {
      token: managerToken,
      method: 'POST',
      body: { empId: 'e2', date: '2026-06-10', entries: [{ type: 'not-real' }] },
    });
    assert.equal(badAssignment.status, 400);
    assert.equal(badAssignment.payload.error, 'BAD_ASSIGNMENT_TYPE');

    const badShift = await json(base, '/api/shifts', {
      token: managerToken,
      method: 'POST',
      body: { empId: 'e2', title: 'Turno errato', bu: 'bu1', day: 'Lun', time: '09:00–18:00', start: '2026-06-20', end: '2026-06-01' },
    });
    assert.equal(badShift.status, 400);
    assert.equal(badShift.payload.error, 'MISSING_FIELDS');

    // e2 has pending ferie request r1 from 2026-06-08 to 2026-06-12 → full-week absence blocks on-call
    const oncallConflict = await json(base, '/api/oncall', {
      token: managerToken,
      method: 'POST',
      body: { empId: 'e2', from: '2026-06-08', to: '2026-06-12', time: '18:00–08:00' },
    });
    assert.equal(oncallConflict.status, 409);
    assert.equal(oncallConflict.payload.error, 'ABSENCE_CONFLICT');
  });
});

test('SuperAdmin is blocked from operational endpoints', async () => {
  await resetState();
  await withServer(async (base) => {
    const superToken = await login(base, 'superadmin@peopleplanner.local');

    // Dashboard returns 403
    const dashboard = await json(base, '/api/dashboard', { token: superToken });
    assert.equal(dashboard.status, 403);
    assert.equal(dashboard.payload.error, 'ADMIN_ONLY');

    // Assignments blocked
    const assignment = await json(base, '/api/assignments', {
      token: superToken,
      method: 'POST',
      body: { empId: 'e2', date: '2026-06-10', entries: [{ type: 'turno', time: '09:00–18:00' }] },
    });
    assert.equal(assignment.status, 403);
    assert.equal(assignment.payload.error, 'SUPERADMIN_NOT_ALLOWED');

    // Oncall blocked
    const oncall = await json(base, '/api/oncall', {
      token: superToken,
      method: 'POST',
      body: { empId: 'e4', from: '2026-07-01', time: '18:00–08:00' },
    });
    assert.equal(oncall.status, 403);
    assert.equal(oncall.payload.error, 'SUPERADMIN_NOT_ALLOWED');

    // Shifts blocked
    const shift = await json(base, '/api/shifts', {
      token: superToken,
      method: 'POST',
      body: { empId: 'e2', title: 'Test', bu: 'bu1', day: 'Lun', time: '09:00–18:00', start: '2026-06-20' },
    });
    assert.equal(shift.status, 403);
    assert.equal(shift.payload.error, 'SUPERADMIN_NOT_ALLOWED');

    // Bootstrap returns only people and bus, no operational data
    const bootstrap = await json(base, '/api/bootstrap', { token: superToken });
    assert.equal(bootstrap.status, 200);
    assert.ok(bootstrap.payload.people.length > 0);
    assert.ok(bootstrap.payload.bus.length > 0);
    assert.deepEqual(bootstrap.payload.requests, []);
    assert.deepEqual(bootstrap.payload.shifts, []);
    assert.deepEqual(bootstrap.payload.oncall, []);
    assert.deepEqual(bootstrap.payload.closures, []);
    assert.deepEqual(bootstrap.payload.assign, {});
  });
});

test('on-call allows assignment during closures but blocks full-week ferie', async () => {
  await resetState();
  await withServer(async (base) => {
    const managerToken = await login(base, 'manager@peopleplanner.local');

    // e4 is in bu1 (managed by e1), no ferie during Aug 10-16 → closures don't block on-call
    const oncallDuringClosure = await json(base, '/api/oncall', {
      token: managerToken,
      method: 'POST',
      body: { empId: 'e4', from: '2026-08-10', to: '2026-08-16', time: '18:00–08:00' },
    });
    assert.equal(oncallDuringClosure.status, 201);
    assert.ok(oncallDuringClosure.payload.oncall);

    // e3 has pending ferie r4 on 2026-06-09 to 2026-06-10
    // Test: on-call for a period where e3 has full ferie via request → should block
    const oncallFullFerie = await json(base, '/api/oncall', {
      token: managerToken,
      method: 'POST',
      body: { empId: 'e3', from: '2026-06-09', to: '2026-06-10', time: '18:00–08:00' },
    });
    assert.equal(oncallFullFerie.status, 409);
    assert.equal(oncallFullFerie.payload.error, 'ABSENCE_CONFLICT');

    // Auto-calculate end date: from only → should set to=from+6 days
    const oncallAutoEnd = await json(base, '/api/oncall', {
      token: managerToken,
      method: 'POST',
      body: { empId: 'e4', from: '2026-07-06', time: '18:00–08:00' },
    });
    assert.equal(oncallAutoEnd.status, 201);
    assert.equal(oncallAutoEnd.payload.oncall.from, '2026-07-06');
    assert.equal(oncallAutoEnd.payload.oncall.to, '2026-07-12');
  });
});

test('shift preset creation works', async () => {
  await resetState();
  await withServer(async (base) => {
    const managerToken = await login(base, 'manager@peopleplanner.local');

    // venerdi preset
    const venerdi = await json(base, '/api/shifts', {
      token: managerToken,
      method: 'POST',
      body: { bu: 'bu1', preset: 'venerdi', start: '2026-06-01', end: '2026-06-30' },
    });
    assert.equal(venerdi.status, 201);
    assert.equal(venerdi.payload.shift.title, 'Venerdì 11-18');
    assert.equal(venerdi.payload.shift.day, 'Ven');
    assert.equal(venerdi.payload.shift.time, '11:00–18:00');

    // presidio-italo preset with weekStart/weekEnd
    const italo = await json(base, '/api/shifts', {
      token: managerToken,
      method: 'POST',
      body: { bu: 'bu1', preset: 'presidio-italo', empId: 'e2', weekStart: '2026-06-01', weekEnd: '2026-06-07' },
    });
    assert.equal(italo.status, 201);
    assert.equal(italo.payload.shift.title, 'Presidio Italo');
    assert.equal(italo.payload.shift.day, 'Lun,Gio');
    assert.equal(italo.payload.shift.time, '09:00–18:00');
    assert.equal(italo.payload.shift.start, '2026-06-01');
    assert.equal(italo.payload.shift.end, '2026-06-07');

    // agn preset
    const agn = await json(base, '/api/shifts', {
      token: managerToken,
      method: 'POST',
      body: { bu: 'bu1', preset: 'agn', empId: 'e4', start: '2026-07-01' },
    });
    assert.equal(agn.status, 201);
    assert.equal(agn.payload.shift.title, 'AGN');
    assert.equal(agn.payload.shift.day, 'Lun–Ven');
    assert.equal(agn.payload.shift.time, '08:30–17:30');

    // invalid preset
    const badPreset = await json(base, '/api/shifts', {
      token: managerToken,
      method: 'POST',
      body: { bu: 'bu1', preset: 'nonexistent', start: '2026-06-01' },
    });
    assert.equal(badPreset.status, 400);
    assert.equal(badPreset.payload.error, 'BAD_PRESET');
  });
});

test('profile avatar upload works', async () => {
  await resetState();
  await withServer(async (base) => {
    const managerToken = await login(base, 'manager@peopleplanner.local');

    // Upload color avatar
    const colorAvatar = await json(base, '/api/profile/avatar', {
      token: managerToken,
      method: 'POST',
      body: { avatar: '#FF0000' },
    });
    assert.equal(colorAvatar.status, 200);
    assert.equal(colorAvatar.payload.user.avatar, '#FF0000');

    // Upload base64 avatar
    const b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const b64Avatar = await json(base, '/api/profile/avatar', {
      token: managerToken,
      method: 'POST',
      body: { avatar: b64 },
    });
    assert.equal(b64Avatar.status, 200);
    assert.equal(b64Avatar.payload.user.avatar, b64);

    // Missing avatar
    const noAvatar = await json(base, '/api/profile/avatar', {
      token: managerToken,
      method: 'POST',
      body: {},
    });
    assert.equal(noAvatar.status, 400);
    assert.equal(noAvatar.payload.error, 'BAD_INPUT');
  });
});
