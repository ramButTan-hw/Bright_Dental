const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveConfig } = require('../database/config');

const local = { DB_HOST: 'localhost', DB_USER: 'clinic', DB_NAME: 'clinic', DB_PASSWORD: '' };

test('local MySQL supports an empty password without enabling TLS', () => {
  const config = resolveConfig('local', local);
  assert.equal(config.password, '');
  assert.equal(config.port, 3306);
  assert.equal(config.ssl, undefined);
});

test('Azure verification uses its own settings and verifies TLS certificates by default', () => {
  const config = resolveConfig('azure', {
    ...local, AZURE_DB_HOST: 'clinic.mysql.database.azure.com',
    AZURE_DB_USER: 'azureuser', AZURE_DB_NAME: 'azureclinic'
  });
  assert.equal(config.host, 'clinic.mysql.database.azure.com');
  assert.equal(config.user, 'azureuser');
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test('TLS is honored independently of NODE_ENV for runtime and verification', () => {
  assert.deepEqual(resolveConfig('default', { ...local, DB_SSL: 'true' }).ssl, { rejectUnauthorized: true });
});

test('Azure target never falls back to a local database', () => {
  assert.throws(() => resolveConfig('azure', local), /Missing AZURE_DB_/);
});

test('invalid targets, TLS values, and unavailable CA files fail clearly', () => {
  assert.throws(() => resolveConfig('typo', local), /Unknown database target/);
  assert.throws(() => resolveConfig('default', { ...local, DB_SSL: 'typo' }), /DB_SSL/);
  assert.throws(() => resolveConfig('default', { ...local, DB_SSL: 'true', DB_SSL_CA: '/missing/ca.pem' }), /ENOENT/);
});
