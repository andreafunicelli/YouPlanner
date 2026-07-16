export const DEFAULT_TWEAKS = Object.freeze({
  direzione: 'A',
  densita: 'standard',
  vista: 'settimana',
  mostraConflitti: true,
  sogliaAssenti: 3,
  sogliaRemote: 3,
  accento: '#E03127',
  colFerie: '#E08A1E',
  colSw: '#2D7FF0',
});

const oneOf = (...values) => (value) => values.includes(value);
const threshold = (value) => Number.isInteger(value) && value >= 2 && value <= 5;
const color = (value) => /^#[0-9a-f]{6}$/i.test(String(value));

const validators = {
  direzione: oneOf('A', 'B'),
  densita: oneOf('compatta', 'standard', 'comoda'),
  vista: oneOf('settimana', 'mese', 'giorno'),
  mostraConflitti: (value) => typeof value === 'boolean',
  sogliaAssenti: threshold,
  sogliaRemote: threshold,
  accento: color,
  colFerie: color,
  colSw: color,
};

export function validateTweakEdits(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const edits = {};
  for (const [key, value] of Object.entries(input)) {
    if (!validators[key]?.(value)) return null;
    edits[key] = value;
  }
  return edits;
}

export function normalizeTweaks(input) {
  const valid = validateTweakEdits(input || {});
  return valid || {};
}
