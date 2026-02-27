#!/usr/bin/env node

const baseUrl = process.env.NOSTRMAXI_API_BASE || 'http://localhost:3000';

function help() {
  console.log(`nostrmaxi CLI\n\nUsage:\n  nostrmaxi verify <npub>\n  nostrmaxi register <user@domain.com> <npub>\n  nostrmaxi status <npub>\n\nEnv:\n  NOSTRMAXI_API_BASE   API base URL (default: http://localhost:3000)`);
}

function parseArgs(argv) {
  const [cmd, ...args] = argv;

  if (!cmd || ['-h', '--help', 'help'].includes(cmd)) {
    return { type: 'help' };
  }

  if (cmd === 'verify') {
    if (args.length !== 1) throw new Error('Usage: nostrmaxi verify <npub>');
    return { type: 'verify', npub: args[0] };
  }

  if (cmd === 'register') {
    if (args.length !== 2) throw new Error('Usage: nostrmaxi register <user@domain.com> <npub>');
    return { type: 'register', address: args[0], npub: args[1] };
  }

  if (cmd === 'status') {
    if (args.length !== 1) throw new Error('Usage: nostrmaxi status <npub>');
    return { type: 'status', npub: args[0] };
  }

  throw new Error(`Unknown command: ${cmd}`);
}

async function get(path) {
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${txt}`);
  }

  return res.json();
}

async function run(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);

  if (parsed.type === 'help') {
    help();
    return;
  }

  if (parsed.type === 'verify') {
    const result = await post('/api/v1/identity/verify', { npub: parsed.npub });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (parsed.type === 'register') {
    const result = await post('/api/v1/nip05/register', { address: parsed.address, npub: parsed.npub });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (parsed.type === 'status') {
    const result = await get(`/api/v1/subscriptions/${encodeURIComponent(parsed.npub)}`);
    console.log(JSON.stringify(result, null, 2));
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { run, parseArgs, help };
