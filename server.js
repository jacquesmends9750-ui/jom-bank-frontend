const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(require('cors')());
app.use(express.static(path.join(__dirname)));

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      pin TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      failed_login_count INTEGER NOT NULL DEFAULT 0,
      blocked_until TEXT,
      otp_code TEXT,
      otp_expires_at TEXT,
      otp_attempts INTEGER NOT NULL DEFAULT 0,
      otp_purpose TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS beneficiaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      beneficiary_name TEXT NOT NULL,
      beneficiary_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(account_id, beneficiary_email),
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    );
  `);

  const accountInfo = db.prepare("PRAGMA table_info(accounts)").all();
  const missingColumns = [
    { name: 'failed_login_count', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'blocked_until', type: 'TEXT' },
    { name: 'otp_last_sent_at', type: 'TEXT' },
    { name: 'otp_code', type: 'TEXT' },
    { name: 'otp_expires_at', type: 'TEXT' },
    { name: 'otp_attempts', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'otp_purpose', type: 'TEXT' }
  ];
  missingColumns.forEach((column) => {
    if (!accountInfo.some((item) => item.name === column.name)) {
      db.prepare(`ALTER TABLE accounts ADD COLUMN ${column.name} ${column.type}`).run();
    }
  });

  const admin = db.prepare('SELECT id FROM accounts WHERE email = ?').get('admin@jom.bank');
  if (!admin) {
    const accountNumber = 'JOM000000';
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO accounts (account_number, name, email, phone, pin, balance, status, is_admin, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`)
      .run(accountNumber, 'J.O.M Admin', 'admin@jom.bank', '+233000000000', '0000', 0, now, now);
    console.log('Admin account created: admin@jom.bank / PIN 0000');
  }
}

function generateToken() {
  return crypto.randomBytes(28).toString('hex');
}

function createSession(accountId) {
  const token = generateToken();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO sessions (token, account_id, created_at) VALUES (?, ?, ?)').run(token, accountId, now);
  return token;
}

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendOtp(account, purpose, code) {
  const destination = account.phone || account.email;
  console.log(`Sending OTP for ${purpose} to ${destination}: ${code}`);
}

function storeOtp(accountId, purpose) {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
  const now = new Date().toISOString();
  db.prepare(`UPDATE accounts SET otp_code = ?, otp_expires_at = ?, otp_last_sent_at = ?, otp_attempts = 0, otp_purpose = ?, updated_at = ? WHERE id = ?`)
    .run(code, expiresAt, now, purpose, now, accountId);
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  sendOtp(account, purpose, code);
  return code;
}

app.post('/api/resend-otp', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.toLowerCase());
  if (!account) return res.status(404).json({ error: 'Account not found.' });
  const now = new Date();
  if (account.otp_last_sent_at && new Date(account.otp_last_sent_at) > new Date(now.getTime() - 60 * 1000)) {
    const next = new Date(new Date(account.otp_last_sent_at).getTime() + 60 * 1000).toISOString();
    return res.status(429).json({ error: 'Please wait before resending OTP.', nextAllowedAt: next });
  }
  storeOtp(account.id, account.otp_purpose || 'login');
  return res.json({ message: 'OTP resent.' });
});

app.post('/api/forgot-pin', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.toLowerCase());
  if (!account) return res.status(404).json({ error: 'Account not found.' });
  storeOtp(account.id, 'reset');
  return res.json({ otpRequired: true, email: account.email, message: 'OTP sent for PIN reset.' });
});

app.post('/api/reset-pin', (req, res) => {
  const { email, otp, newPin, confirmPin } = req.body;
  if (!email || !otp || !newPin || !confirmPin) return res.status(400).json({ error: 'Email, OTP and new PIN required.' });
  if (newPin !== confirmPin) return res.status(400).json({ error: 'PIN confirmation mismatch.' });
  if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ error: 'PIN must be 4 digits.' });
  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.toLowerCase());
  if (!account) return res.status(404).json({ error: 'Account not found.' });
  if (!account.otp_code || !account.otp_expires_at) return res.status(400).json({ error: 'No OTP request found.' });
  if (new Date(account.otp_expires_at) < new Date()) return res.status(400).json({ error: 'OTP expired.' });
  if (otp !== account.otp_code) {
    const attempts = account.otp_attempts + 1;
    const nowIso = new Date().toISOString();
    if (attempts >= 3) {
      const blockedUntil = new Date(Date.now() + 15 * 60000).toISOString();
      db.prepare('UPDATE accounts SET otp_attempts = 0, blocked_until = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(blockedUntil, 'locked', nowIso, account.id);
      return res.status(401).json({ error: 'Invalid OTP. Account temporarily locked.' });
    }
    db.prepare('UPDATE accounts SET otp_attempts = ?, updated_at = ? WHERE id = ?').run(attempts, nowIso, account.id);
    return res.status(401).json({ error: 'Invalid OTP.' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET pin = ?, otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0, otp_purpose = NULL, updated_at = ? WHERE id = ?')
    .run(newPin, now, account.id);
  return res.json({ message: 'PIN reset successful. You can login with your new PIN.' });
});

function getAccountFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT a.* FROM accounts a
    JOIN sessions s ON s.account_id = a.id
    WHERE s.token = ?
  `).get(token);
  return row || null;
}

function sanitizeAccount(account) {
  if (!account) return null;
  const { password, pin, ...rest } = account; // eslint-disable-line no-unused-vars
  return {
    id: account.id,
    accountNumber: account.account_number,
    name: account.name,
    email: account.email,
    phone: account.phone,
    balance: account.balance,
    status: account.status,
    isAdmin: Boolean(account.is_admin),
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  };
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token || req.body.token;
  const account = getAccountFromToken(token);
  if (!account) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.account = account;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.account || !req.account.is_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

function makeAccountNumber() {
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `JOM${randomDigits}`;
}

app.post('/api/register', (req, res) => {
  const { name, email, phone, pin, confirmPin } = req.body;
  if (!name || !email || !pin || !confirmPin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'Name, email, and a 4-digit PIN are required.' });
  }
  if (pin !== confirmPin) {
    return res.status(400).json({ error: 'PIN and confirmation do not match.' });
  }
  const exists = db.prepare('SELECT id FROM accounts WHERE email = ?').get(email.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'Account already exists.' });
  }
  const accountNumber = makeAccountNumber();
  const now = new Date().toISOString();
  const result = db.prepare(`INSERT INTO accounts (account_number, name, email, phone, pin, balance, status, is_admin, created_at, updated_at)
                                 VALUES (?, ?, ?, ?, ?, 0, 'pending', 0, ?, ?)`)
    .run(accountNumber, name, email.toLowerCase(), phone, pin, now, now);
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  storeOtp(account.id, 'register');
  return res.json({ otpRequired: true, email: account.email, message: 'OTP sent to your phone or email for verification.' });
});

app.post('/api/login', (req, res) => {
  const { email, pin } = req.body;
  if (!email || !pin) {
    return res.status(400).json({ error: 'Email and PIN are required.' });
  }
  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.toLowerCase());
  if (!account) {
    return res.status(401).json({ error: 'Invalid login credentials.' });
  }

  const now = new Date();
  if (account.blocked_until && new Date(account.blocked_until) > now) {
    return res.status(403).json({ error: 'Account temporarily blocked due to failed login attempts. Try again later.' });
  }

  if (account.status === 'pending') {
    return res.status(403).json({ error: 'Account pending admin approval.' });
  }
  if (account.status === 'frozen') {
    return res.status(403).json({ error: 'Account is frozen. Contact support.' });
  }

  if (account.pin !== pin) {
    const attempts = account.failed_login_count + 1;
    const nowIso = now.toISOString();
    if (attempts >= 3) {
      const blockedUntil = new Date(now.getTime() + 15 * 60000).toISOString();
      db.prepare('UPDATE accounts SET failed_login_count = 0, blocked_until = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(blockedUntil, 'locked', nowIso, account.id);
      return res.status(401).json({ error: 'Account locked after 3 failed attempts. Try again in 15 minutes.' });
    }
    db.prepare('UPDATE accounts SET failed_login_count = ?, updated_at = ? WHERE id = ?')
      .run(attempts, nowIso, account.id);
    return res.status(401).json({ error: `Invalid login credentials. ${3 - attempts} attempt(s) left before lock.` });
  }

  if (account.status === 'locked' && account.blocked_until && new Date(account.blocked_until) <= now) {
    db.prepare('UPDATE accounts SET status = ?, failed_login_count = 0, blocked_until = NULL, updated_at = ? WHERE id = ?')
      .run('active', now.toISOString(), account.id);
    account.status = 'active';
  }

  if (account.status !== 'active') {
    return res.status(403).json({ error: 'Account cannot login until it is active.' });
  }

  db.prepare('UPDATE accounts SET failed_login_count = 0, blocked_until = NULL, updated_at = ? WHERE id = ?').run(now.toISOString(), account.id);
  storeOtp(account.id, 'login');
  return res.json({ otpRequired: true, email: account.email, message: 'OTP sent to your phone or email.' });
});

app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }
  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.toLowerCase());
  if (!account) {
    return res.status(404).json({ error: 'Account not found.' });
  }
  if (!account.otp_code || !account.otp_expires_at) {
    return res.status(400).json({ error: 'No OTP request found. Please login again.' });
  }
  if (new Date(account.otp_expires_at) < new Date()) {
    return res.status(400).json({ error: 'OTP has expired. Please request a new login.' });
  }
  if (otp !== account.otp_code) {
    const attempts = account.otp_attempts + 1;
    const nowIso = new Date().toISOString();
    if (attempts >= 3) {
      const blockedUntil = new Date(Date.now() + 15 * 60000).toISOString();
      db.prepare('UPDATE accounts SET otp_attempts = 0, blocked_until = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(blockedUntil, 'locked', nowIso, account.id);
      return res.status(401).json({ error: 'OTP invalid. Account temporarily locked. Try again later.' });
    }
    db.prepare('UPDATE accounts SET otp_attempts = ?, updated_at = ? WHERE id = ?').run(attempts, nowIso, account.id);
    return res.status(401).json({ error: `Invalid OTP. ${3 - attempts} attempt(s) left before lock.` });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0, otp_purpose = NULL, updated_at = ? WHERE id = ?')
    .run(now, account.id);

  if (account.status === 'active') {
    const token = createSession(account.id);
    return res.json({ token, account: sanitizeAccount(account) });
  }

  return res.json({ message: 'OTP verified. Your account is pending admin approval.' });
});

app.get('/api/account', requireAuth, (req, res) => {
  if (req.account.status !== 'active' && !req.account.is_admin) {
    return res.status(403).json({ error: 'Account is frozen.' });
  }
  return res.json({ account: sanitizeAccount(req.account) });
});

app.get('/api/transactions', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 5;
  const transactions = db.prepare('SELECT type, amount, note, created_at FROM transactions WHERE account_id = ? ORDER BY id DESC LIMIT ?').all(req.account.id, limit);
  return res.json({ transactions });
});

app.post('/api/deposit', requireAuth, (req, res) => {
  const { amount } = req.body;
  const value = parseFloat(amount);
  if (Number.isNaN(value) || value <= 0) {
    return res.status(400).json({ error: 'Invalid amount.' });
  }
  if (req.account.status !== 'active') {
    return res.status(403).json({ error: 'Account is frozen.' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?').run(value, now, req.account.id);
  db.prepare('INSERT INTO transactions (account_id, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.account.id, 'Deposit', value, 'Account deposit', now);
  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.account.id);
  return res.json({ account: sanitizeAccount(updated) });
});

app.post('/api/withdraw', requireAuth, (req, res) => {
  const { amount } = req.body;
  const value = parseFloat(amount);
  if (Number.isNaN(value) || value <= 0) {
    return res.status(400).json({ error: 'Invalid amount.' });
  }
  if (req.account.status !== 'active') {
    return res.status(403).json({ error: 'Account is frozen.' });
  }
  if (value > req.account.balance) {
    return res.status(400).json({ error: 'Insufficient funds.' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?').run(value, now, req.account.id);
  db.prepare('INSERT INTO transactions (account_id, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.account.id, 'Withdrawal', -value, 'Cash withdrawal', now);
  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.account.id);
  return res.json({ account: sanitizeAccount(updated) });
});

app.post('/api/pay-bill', requireAuth, (req, res) => {
  const { amount, billType } = req.body;
  const value = parseFloat(amount);
  if (!billType || Number.isNaN(value) || value <= 0) {
    return res.status(400).json({ error: 'Invalid bill payment data.' });
  }
  if (req.account.status !== 'active') {
    return res.status(403).json({ error: 'Account is frozen.' });
  }
  if (value > req.account.balance) {
    return res.status(400).json({ error: 'Insufficient funds.' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?').run(value, now, req.account.id);
  db.prepare('INSERT INTO transactions (account_id, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.account.id, 'Bill payment', -value, billType, now);
  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.account.id);
  return res.json({ account: sanitizeAccount(updated) });
});

app.post('/api/beneficiaries', requireAuth, (req, res) => {
  const { beneficiaryName, beneficiaryEmail } = req.body;
  if (!beneficiaryName || !beneficiaryEmail) {
    return res.status(400).json({ error: 'Beneficiary name and email are required.' });
  }
  const now = new Date().toISOString();
  try {
    db.prepare(`INSERT INTO beneficiaries (account_id, beneficiary_name, beneficiary_email, created_at)
                VALUES (?, ?, ?, ?)`)
      .run(req.account.id, beneficiaryName, beneficiaryEmail.toLowerCase(), now);
  } catch (error) {
    return res.status(400).json({ error: 'This beneficiary already exists.' });
  }
  const beneficiaries = db.prepare('SELECT beneficiary_name, beneficiary_email FROM beneficiaries WHERE account_id = ?').all(req.account.id);
  return res.json({ beneficiaries });
});

app.get('/api/beneficiaries', requireAuth, (req, res) => {
  const beneficiaries = db.prepare('SELECT beneficiary_name, beneficiary_email FROM beneficiaries WHERE account_id = ?').all(req.account.id);
  return res.json({ beneficiaries });
});

app.delete('/api/beneficiaries', requireAuth, (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Beneficiary email is required.' });
  }
  db.prepare('DELETE FROM beneficiaries WHERE account_id = ? AND beneficiary_email = ?').run(req.account.id, email.toLowerCase());
  const beneficiaries = db.prepare('SELECT beneficiary_name, beneficiary_email FROM beneficiaries WHERE account_id = ?').all(req.account.id);
  return res.json({ beneficiaries });
});

app.post('/api/transfer', requireAuth, (req, res) => {
  const { toEmail, amount, note } = req.body;
  const value = parseFloat(amount);
  if (!toEmail || Number.isNaN(value) || value <= 0) {
    return res.status(400).json({ error: 'Valid recipient email and amount are required.' });
  }
  if (req.account.status !== 'active') {
    return res.status(403).json({ error: 'Account is not active.' });
  }
  if (value > req.account.balance) {
    return res.status(400).json({ error: 'Insufficient funds for transfer.' });
  }
  const recipient = db.prepare('SELECT * FROM accounts WHERE email = ? AND status = ?').get(toEmail.toLowerCase(), 'active');
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient account not found or not active.' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?').run(value, now, req.account.id);
  db.prepare('UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?').run(value, now, recipient.id);
  db.prepare('INSERT INTO transactions (account_id, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.account.id, 'Transfer sent', -value, note || `To ${toEmail}`, now);
  db.prepare('INSERT INTO transactions (account_id, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(recipient.id, 'Transfer received', value, note || `From ${req.account.email}`, now);
  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.account.id);
  return res.json({ account: sanitizeAccount(updated) });
});

app.post('/api/change-pin', requireAuth, (req, res) => {
  const { currentPin, newPin } = req.body;
  if (!currentPin || !newPin || !/^\d{4}$/.test(newPin)) {
    return res.status(400).json({ error: 'A valid 4-digit PIN is required.' });
  }
  if (currentPin !== req.account.pin) {
    return res.status(400).json({ error: 'Current PIN is incorrect.' });
  }
  if (currentPin === newPin) {
    return res.status(400).json({ error: 'New PIN must be different.' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET pin = ?, updated_at = ? WHERE id = ?').run(newPin, now, req.account.id);
  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.account.id);
  return res.json({ account: sanitizeAccount(updated) });
});

app.post('/api/admin/verify', requireAuth, requireAdmin, (req, res) => {
  const { email, action } = req.body;
  if (!email || !action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Email and valid action are required.' });
  }
  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.toLowerCase());
  if (!account || account.is_admin) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if (account.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending accounts can be verified.' });
  }
  const now = new Date().toISOString();
  const status = action === 'approve' ? 'active' : 'rejected';
  db.prepare('UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?').run(status, now, account.id);
  return res.json({ success: true, status });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, account_number, name, email, phone, balance, status, created_at FROM accounts WHERE is_admin = 0 ORDER BY created_at DESC').all();
  return res.json({ users });
});

app.post('/api/admin/freeze', requireAuth, requireAdmin, (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.toLowerCase());
  if (!account || account.is_admin) {
    return res.status(404).json({ error: 'User not found.' });
  }
  let nextStatus = account.status;
  if (account.status === 'active') {
    nextStatus = 'frozen';
  } else if (account.status === 'frozen' || account.status === 'pending' || account.status === 'rejected') {
    nextStatus = 'active';
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now, account.id);
  return res.json({ success: true, status: nextStatus });
});

app.post('/api/admin/unlock', requireAuth, requireAdmin, (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.toLowerCase());
  if (!account || account.is_admin) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if (account.status !== 'locked') {
    return res.status(400).json({ error: 'Account is not locked.' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET status = ?, failed_login_count = 0, updated_at = ? WHERE id = ?').run('active', now, account.id);
  return res.json({ success: true, status: 'active' });
});

app.get('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token || req.body.token;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return res.json({ success: true });
});

app.listen(PORT, () => {
  initDatabase();
  console.log(`J.O.M Bank server running on http://localhost:${PORT}`);
});
