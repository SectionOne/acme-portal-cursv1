const path = require('path');
const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./auth');
const {
  getClientsFast,
  invitations,
  delay,
} = require('./db');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'acme-portal' });
  });

  /** Panell admin: lent a propòsit */
  app.get('/api/clients', requireAuth, async (_req, res) => {
    const data = await getClientsFast();
    res.json({ data, meta: { count: data.length, note: 'endpoint lent (lab)' } });
  });

  /** Formulari de contacte. */
  app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Cal name, email i message' });
    }

    return res.status(201).json({
      ok: true,
      ticketId: `T-${Date.now()}`,
      received: { name, email },
    });
  });

  /** Invitacions: check-and-set sense await entremig (evita cursa). */
  app.post('/api/invitations', requireAuth, async (req, res) => {
    const email = (req.body && req.body.email) || '';
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Email invàlid' });
    }

    // Simula latència de xarxa / BD (abans del check-and-set)
    await delay(150);
    await delay(150);

    const existing = invitations.get(email);
    if (existing) {
      return res.status(409).json({
        error: 'Invitació ja existent',
        email,
        token: existing.token,
      });
    }

    const token = `inv_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    invitations.set(email, { token, createdAt: Date.now() });

    return res.status(201).json({ email, token });
  });

  app.get('/api/invitations/:email', requireAuth, (req, res) => {
    const row = invitations.get(req.params.email);
    if (!row) return res.status(404).json({ error: 'No trobat' });
    return res.json(row);
  });

  return app;
}

module.exports = { createApp };
