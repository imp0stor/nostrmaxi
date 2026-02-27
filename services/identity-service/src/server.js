import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { verifyNostrAuth } from '@strangesignal/nostr-auth/server';

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production';
const auth = verifyNostrAuth(jwtSecret);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true, service: 'identity-service' });
  } catch {
    res.status(500).json({ ok: false, service: 'identity-service' });
  }
});

app.get('/api/v1/identity/check-availability', async (req, res) => {
  const { name, domain = process.env.NIP05_DOMAIN || 'nostrmaxi.com' } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing name parameter' });

  const { rows } = await pool.query(
    'select 1 from identities where name = $1 and domain = $2 limit 1',
    [String(name).toLowerCase(), String(domain)]
  );

  res.json({
    available: rows.length === 0,
    name,
    domain,
    nip05: `${name}@${domain}`,
  });
});

app.get('/api/v1/identity/mine', auth, async (req, res) => {
  const pubkey = req.user?.pubkey;
  const { rows } = await pool.query(
    `select i.id, i.name as "localPart", i.domain, i.created_at as "createdAt",
            (i.name || '@' || i.domain) as address
     from identities i
     join users u on u.id = i.user_id
     where u.pubkey = $1
     order by i.created_at desc`,
    [pubkey]
  );

  res.json(rows);
});

app.post('/api/v1/identity', auth, async (req, res) => {
  const pubkey = req.user?.pubkey;
  const { localPart, domain = process.env.NIP05_DOMAIN || 'nostrmaxi.com' } = req.body;

  if (!localPart) return res.status(400).json({ error: 'localPart is required' });

  const { rows: userRows } = await pool.query('select id from users where pubkey = $1 limit 1', [pubkey]);
  if (!userRows.length) return res.status(404).json({ error: 'User not found' });

  const userId = userRows[0].id;
  const insert = await pool.query(
    `insert into identities (user_id, name, domain, nostr_pubkey, is_active, is_verified)
     values ($1, $2, $3, $4, true, true)
     returning id, (name || '@' || domain) as address`,
    [userId, String(localPart).toLowerCase(), String(domain), pubkey]
  );

  res.status(201).json({ identity: insert.rows[0], address: insert.rows[0].address });
});

app.delete('/api/v1/identity', auth, async (req, res) => {
  const pubkey = req.user?.pubkey;
  const { localPart, domain = process.env.NIP05_DOMAIN || 'nostrmaxi.com' } = req.body;

  await pool.query(
    `delete from identities i
     using users u
     where i.user_id = u.id
       and u.pubkey = $1
       and i.name = $2
       and i.domain = $3`,
    [pubkey, String(localPart).toLowerCase(), String(domain)]
  );

  res.json({ ok: true });
});

const port = Number(process.env.IDENTITY_SERVICE_PORT || 3011);
app.listen(port, () => {
  console.log(`identity-service listening on :${port}`);
});
