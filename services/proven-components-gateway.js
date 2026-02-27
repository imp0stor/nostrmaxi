// Auto-generated proven component microservice adapter
function optionalRequire(name, fallback) {
  try { return require(name); } catch { return fallback; }
}

const axios = optionalRequire('axios', { get: async () => ({ data: null }) });
const dateFns = optionalRequire('date-fns', { formatISO: (d) => new Date(d).toISOString() });
const zodLib = optionalRequire('zod', { z: { object: () => ({ parse: (x) => x }), string: () => ({}) } });
const z = zodLib.z || zodLib;

const HealthSchema = z.object({ status: z.string(), service: z.string(), checkedAt: z.string() });

function health(serviceName = 'proven-components-gateway') {
  return HealthSchema.parse({ status: 'ok', service: serviceName, checkedAt: dateFns.formatISO(new Date()) });
}

module.exports = { axios, z, health };
