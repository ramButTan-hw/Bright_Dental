const fs = require('node:fs');

function resolveConfig(target = 'default', env = process.env) {
  if (!['default', 'local', 'azure'].includes(target)) {
    throw new Error(`Unknown database target: ${target}`);
  }
  const prefix = target === 'default' ? '' : `${target.toUpperCase()}_`;
  const read = (key) => env[`${prefix}${key}`] ?? (target === 'local' ? env[key] : undefined);
  const config = {
    host: read('DB_HOST'),
    port: Number(read('DB_PORT') || 3306),
    user: read('DB_USER'),
    password: read('DB_PASSWORD'),
    database: read('DB_NAME')
  };
  const missing = ['host', 'user', 'database'].filter((key) => !config[key]);
  if (missing.length) throw new Error(`Missing ${prefix}DB_ configuration: ${missing.join(', ')}`);
  const ssl = read('DB_SSL') ?? (target === 'azure' ? 'true' : 'false');
  if (!['true', 'false'].includes(ssl)) throw new Error('DB_SSL must be true or false');
  if (ssl === 'true') {
    config.ssl = { rejectUnauthorized: true };
    const caPath = read('DB_SSL_CA');
    if (caPath) config.ssl.ca = fs.readFileSync(caPath, 'utf8');
  }
  return config;
}

module.exports = { resolveConfig };
