import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../store.mjs';
import { businessDays, holidaysFor, userScope, hasAbsenceOverlap, getEntries, notificationsFor } from '../domain.mjs';

test('Italian Easter and Easter Monday are calculated dynamically', () => {
  const h2026 = holidaysFor(2026);
  const h2027 = holidaysFor(2027);
  assert.equal(h2026['2026-04-05'], 'Pasqua');
  assert.equal(h2026['2026-04-06'], "Lunedì dell'Angelo");
  assert.equal(h2027['2027-03-28'], 'Pasqua');
  assert.equal(h2027['2027-03-29'], "Lunedì dell'Angelo");
});

test('manager without assigned BU sees zero operational records', () => {
  const state = seedState();
  const manager = state.users.find((u) => u.email === 'manager-empty@peopleplanner.local');
  const scope = userScope(state, manager);
  assert.deepEqual(scope.teamIds, []);
  assert.deepEqual(scope.employeeIds, []);
});

test('company closures and national holidays do not count as requested vacation days', () => {
  const state = seedState();
  assert.equal(businessDays(state, '2026-06-01', '2026-06-02'), 0);
  assert.equal(businessDays(state, '2026-06-01', '2026-06-03'), 1);
});

test('national holiday and closure entries are derived, not fake requests', () => {
  const state = seedState();
  assert.equal(getEntries(state, 'e2', '2026-06-02')[0].type, 'festa');
  assert.equal(getEntries(state, 'e2', '2026-06-01')[0].type, 'chiusura');
  assert.equal(getEntries(state, 'e10', '2026-08-10')[0].type, 'presidio');
  assert.equal(state.requests.some((r) => r.from === '2026-06-02' && r.type === 'festa'), false);
});

test('absence overlap detects pending/approved leave conflicts', () => {
  const state = seedState();
  assert.equal(hasAbsenceOverlap(state, 'e3', '2026-06-09', '2026-06-09')?.id, 'r4');
  assert.equal(hasAbsenceOverlap(state, 'e3', '2026-07-09', '2026-07-09'), null);
});


test('notifications respect manager scope and superadmin operational boundary', () => {
  const state = seedState();
  const manager = state.users.find((u) => u.email === 'manager@peopleplanner.local');
  const emptyManager = state.users.find((u) => u.email === 'manager-empty@peopleplanner.local');
  const superAdmin = state.users.find((u) => u.email === 'superadmin@peopleplanner.local');
  const managerNotifications = notificationsFor(state, manager);
  assert.equal(managerNotifications.some((n) => n.body.includes('Simone Ricci')), false);
  assert.equal(managerNotifications.some((n) => n.body.includes('Luca Ferrari')), true);
  assert.deepEqual(notificationsFor(state, emptyManager), []);
  assert.deepEqual(notificationsFor(state, superAdmin), []);
});
