const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { getPool } = require("../db/mysql");

const router = express.Router();

const codes = new Map();
const throttle = new Map();

function genCode() {
  return (Math.floor(Math.random() * 900000) + 100000).toString();
}

function signToken(payload) {
  const secret = process.env.JWT_SECRET || "dev_secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

function verifyToken(token) {
  try {
    const secret = process.env.JWT_SECRET || "dev_secret";
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

async function ensureUser(email) {
  const pool = getPool();
  const [rows] = await pool.query("SELECT id,email,username FROM users WHERE email=?", [email]);
  if (rows.length) return rows[0];
  const res = await pool.query("INSERT INTO users (email) VALUES (?)", [email]);
  const id = res[0].insertId;
  return { id, email };
}

function getTransporter() {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

router.post("/send-code", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ success: false, msg: "邮箱格式错误" });
  const last = throttle.get(email) || 0;
  const now = Date.now();
  if (now - last < 60000) return res.status(429).json({ success: false, msg: "发送过于频繁" });
  throttle.set(email, now);
  const code = genCode();
  codes.set(email, { code, expireAt: now + 5 * 60 * 1000 });
  const transporter = getTransporter();
  let sent = false;
  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: "登录验证码",
        text: `验证码：${code}，5分钟内有效`
      });
      sent = true;
    } catch {}
  }
  if (!sent) {
    console.log(`验证码发送失败或未配置SMTP，邮箱：${email}，验证码：${code}`);
  }
  res.json({ success: true });
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();
  const item = codes.get(email);
  if (!item) return res.status(400).json({ success: false, msg: "请先获取验证码" });
  if (Date.now() > item.expireAt) return res.status(400).json({ success: false, msg: "验证码已过期" });
  if (item.code !== code) return res.status(400).json({ success: false, msg: "验证码错误" });
  const user = await ensureUser(email);
  const token = signToken({ uid: user.id, email: user.email });
  res.json({ success: true, token });
});

router.post("/register", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ success: false, msg: "邮箱格式错误" });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ success: false, msg: "用户名需为3-20位字母数字下划线" });
  if (password.length < 6) return res.status(400).json({ success: false, msg: "密码至少6位" });
  const pool = getPool();
  const [exists] = await pool.query("SELECT id FROM users WHERE email=? OR username=?", [email, username]);
  if (exists.length) return res.status(409).json({ success: false, msg: "邮箱或用户名已被占用" });
  const hash = await bcrypt.hash(password, 10);
  const r = await pool.query("INSERT INTO users (email,username,password_hash) VALUES (?,?,?)", [email, username, hash]);
  const id = r[0].insertId;
  const token = signToken({ uid: id, email, username });
  res.json({ success: true, token });
});

router.post("/login-password", async (req, res) => {
  const account = String(req.body?.account || "").trim(); // email or username
  const password = String(req.body?.password || "");
  if (!account || !password) return res.status(400).json({ success: false, msg: "请输入账号和密码" });
  const pool = getPool();
  const [rows] = await pool.query("SELECT id,email,username,password_hash FROM users WHERE email=? OR username=? LIMIT 1", [account.toLowerCase(), account]);
  if (!rows.length || !rows[0].password_hash) return res.status(401).json({ success: false, msg: "账号或密码错误" });
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ success: false, msg: "账号或密码错误" });
  const token = signToken({ uid: rows[0].id, email: rows[0].email, username: rows[0].username });
  res.json({ success: true, token });
});

router.get("/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ ok: false });
  const payload = verifyToken(m[1]);
  if (!payload) return res.status(401).json({ ok: false });
  res.json({ ok: true, user: { id: payload.uid, email: payload.email } });
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ success: false, msg: "未授权" });
  const payload = verifyToken(m[1]);
  if (!payload) return res.status(401).json({ success: false, msg: "令牌无效" });
  req.user = { id: payload.uid, email: payload.email };
  next();
}

module.exports = { router, authMiddleware };
