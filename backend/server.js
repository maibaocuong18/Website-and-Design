const express = require('express');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { sql, getPool, initializeDatabase } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);

const projectRoot = path.resolve(__dirname, '..');

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  return '';
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'noir-fashion-backend' });
});

app.post('/api/auth/register', async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!fullName || !email || !password) {
    return res.status(400).json({ ok: false, message: 'Full name, email, and password are required.' });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ ok: false, message: 'Email format is invalid.' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ ok: false, message: passwordError });
  }

  try {
    const pool = await getPool();
    const existing = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .query('SELECT TOP 1 Id FROM dbo.Users WHERE Email = @email');

    if (existing.recordset.length) {
      return res.status(409).json({ ok: false, message: 'This email is already registered. Please login.' });
    }

    await pool
      .request()
      .input('fullName', sql.NVarChar(120), fullName)
      .input('email', sql.NVarChar(255), email)
      .input('password', sql.NVarChar(255), password)
      .query(`
        INSERT INTO dbo.Users (FullName, Email, Password)
        VALUES (@fullName, @email, @password)
      `);

    return res.status(201).json({ ok: true, message: 'Registration successful.' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Database error while registering user.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Email and password are required.' });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .input('password', sql.NVarChar(255), password)
      .query(`
        SELECT TOP 1 FullName, Email
        FROM dbo.Users
        WHERE Email = @email AND Password = @password
      `);

    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({ ok: false, message: 'Invalid email or password.' });
    }

    return res.json({
      ok: true,
      message: 'Login successful.',
      user: {
        fullName: user.FullName,
        email: user.Email
      }
    });
  } catch {
    return res.status(500).json({ ok: false, message: 'Database error while logging in.' });
  }
});

app.get('/api/profile', async (req, res) => {
  const email = normalizeEmail(req.query.email);
  if (!email) {
    return res.status(400).json({ ok: false, message: 'Email query is required.' });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .query(`
        SELECT TOP 1 FullName, Email
        FROM dbo.Users
        WHERE Email = @email
      `);

    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found.' });
    }

    return res.json({ ok: true, user: { fullName: user.FullName, email: user.Email } });
  } catch {
    return res.status(500).json({ ok: false, message: 'Database error while fetching profile.' });
  }
});

app.post('/api/contact', async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const email = normalizeEmail(req.body?.email);
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!fullName || !email || !subject || !message) {
    return res.status(400).json({ ok: false, message: 'All contact fields are required.' });
  }

  try {
    const pool = await getPool();

    // Tìm UserId nếu email thuộc user đã đăng ký
    const userResult = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .query('SELECT TOP 1 Id FROM dbo.Users WHERE Email = @email');
    const userId = userResult.recordset[0]?.Id ?? null;

    await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('fullName', sql.NVarChar(120), fullName)
      .input('email', sql.NVarChar(255), email)
      .input('subject', sql.NVarChar(255), subject)
      .input('message', sql.NVarChar(sql.MAX), message)
      .query(`
        INSERT INTO dbo.ContactMessages (UserId, FullName, Email, Subject, Message)
        VALUES (@userId, @fullName, @email, @subject, @message)
      `);

    return res.status(201).json({ ok: true, message: "Thanks for reaching out. We'll get back to you shortly." });
  } catch {
    return res.status(500).json({ ok: false, message: 'Database error while sending contact message.' });
  }
});

app.use(express.static(projectRoot));

app.get('/api/products', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT Id, Name, Description, Price, ImageUrl, Category, Stock
      FROM dbo.Products
      ORDER BY Id
    `);
    return res.json({ ok: true, products: result.recordset });
  } catch {
    return res.status(500).json({ ok: false, message: 'Database error while fetching products.' });
  }
});

app.get('/api/orders', async (req, res) => {
  const email = normalizeEmail(req.query.email);
  if (!email) {
    return res.status(400).json({ ok: false, message: 'Email query is required.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(255), email)
      .query(`
        SELECT o.Id AS OrderId, o.Status, o.TotalAmount, o.CreatedAt,
               oi.Quantity, oi.UnitPrice,
               p.Name AS ProductName, p.ImageUrl
        FROM dbo.Orders o
        INNER JOIN dbo.Users u      ON u.Id = o.UserId
        INNER JOIN dbo.OrderItems oi ON oi.OrderId = o.Id
        INNER JOIN dbo.Products p   ON p.Id = oi.ProductId
        WHERE u.Email = @email
        ORDER BY o.CreatedAt DESC
      `);
    return res.json({ ok: true, orders: result.recordset });
  } catch {
    return res.status(500).json({ ok: false, message: 'Database error while fetching orders.' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(projectRoot, 'index.html'));
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Noir backend running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  });
