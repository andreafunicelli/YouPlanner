import { randomBytes } from 'node:crypto';

const envFlag = (name, fallback = true) => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return !['0', 'false', 'off', 'no'].includes(String(value).toLowerCase());
};

const SESSION_TTL_MS = Number(process.env.AUTH_SESSION_TTL_MS || 12 * 60 * 60 * 1000);
const LDAP_PASSWORD = process.env.DEMO_LDAP_PASSWORD || 'Demo!2026';
const WORKSPACE_DOMAIN = process.env.DEMO_GOOGLE_DOMAIN || 'youco.demo';

const LDAP_IDENTITIES = [
  { username: 'anna.vitali', userId: 'u-super', name: 'Anna Vitali', role: 'Super Admin' },
  { username: 'elena.conti', userId: 'u-admin1', name: 'Elena Conti', role: 'BU Manager' },
  { username: 'giulia.romano', userId: 'u-employee', name: 'Giulia Romano', role: 'Dipendente' },
  { username: 'manager.senzabu', userId: 'u-admin-empty', name: 'Manager Senza BU', role: 'Manager senza BU' },
];

const GOOGLE_IDENTITIES = [
  { email: `anna.vitali@${WORKSPACE_DOMAIN}`, userId: 'u-super', name: 'Anna Vitali', role: 'Super Admin' },
  { email: `elena.conti@${WORKSPACE_DOMAIN}`, userId: 'u-admin1', name: 'Elena Conti', role: 'BU Manager' },
  { email: `giulia.romano@${WORKSPACE_DOMAIN}`, userId: 'u-employee', name: 'Giulia Romano', role: 'Dipendente' },
];

const sessions = new Map();

export function authConfig() {
  return {
    mode: 'demo',
    sessionTtlHours: Math.round(SESSION_TTL_MS / 3_600_000),
    providers: {
      ldap: {
        enabled: envFlag('LDAP_ENABLED'),
        label: 'LDAP / Active Directory',
        server: process.env.DEMO_LDAP_SERVER || 'ldaps://directory.youco.demo:636',
        baseDn: process.env.DEMO_LDAP_BASE_DN || 'DC=youco,DC=demo',
        identities: LDAP_IDENTITIES.map(({ userId: _userId, ...identity }) => identity),
        demoPassword: LDAP_PASSWORD,
      },
      google: {
        enabled: envFlag('GOOGLE_WORKSPACE_ENABLED'),
        label: 'Google Workspace',
        domain: WORKSPACE_DOMAIN,
        identities: GOOGLE_IDENTITIES.map(({ userId: _userId, ...identity }) => identity),
      },
    },
  };
}

export function authenticateLdap(state, username, password) {
  if (!envFlag('LDAP_ENABLED')) return null;
  const normalized = String(username || '').trim().toLowerCase();
  const identity = LDAP_IDENTITIES.find((item) => item.username === normalized);
  if (!identity || password !== LDAP_PASSWORD) return null;
  const user = state.users.find((item) => item.id === identity.userId);
  return user ? { user, provider: 'ldap', identity: identity.username } : null;
}

export function authenticateGoogle(state, email) {
  if (!envFlag('GOOGLE_WORKSPACE_ENABLED')) return null;
  const normalized = String(email || '').trim().toLowerCase();
  const identity = GOOGLE_IDENTITIES.find((item) => item.email === normalized);
  if (!identity) return null;
  const user = state.users.find((item) => item.id === identity.userId);
  return user ? { user, provider: 'google', identity: identity.email } : null;
}

export function createSession(user, provider = 'local', identity = user.email) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { userId: user.id, provider, identity, expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString(), provider };
}

export function resolveSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function revokeSession(token) {
  return token ? sessions.delete(token) : false;
}
