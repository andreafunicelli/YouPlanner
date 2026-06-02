import test from 'node:test';
import assert from 'node:assert/strict';
import { TODAY, iso } from '../../src/data.js';
import { resetState } from '../store.mjs';
import { getEntries, todayKey } from '../domain.mjs';

test('frontend TODAY follows the real local date instead of stale demo data', () => {
  assert.equal(iso(TODAY), todayKey());
});

test('2026-06-01 closure renders all Sviluppo Software people as absent', async () => {
  const state = await resetState();
  const bu1People = state.people.filter((p) => p.bu === 'bu1');
  const date = '2026-06-01';
  const rows = bu1People.map((p) => ({ person: p.name, entries: getEntries(state, p.id, date) }));

  assert.equal(bu1People.length, 5);
  assert.equal(rows.filter((r) => r.entries.some((e) => e.type === 'chiusura')).length, 5);
  assert.equal(rows.filter((r) => r.entries.some((e) => e.type === 'reperibilita')).length, 0);
  assert.equal(rows.filter((r) => r.entries.some((e) => ['turno', 'sw'].includes(e.type))).length, 0);
});
