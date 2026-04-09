const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { taskManager } = require("../services/mudTask");
const { getPool } = require("../db/mysql");

const router = express.Router();
router.use(authMiddleware);

router.get("/servers", async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id,name,base_host,login_path,check_path FROM mud_servers ORDER BY id ASC",
  );
  res.json({ success: true, servers: rows });
});

router.get("/server-config", async (req, res) => {
  const pool = getPool();
  const serverId = Number(req.query.serverId || 0);
  if (!serverId)
    return res.status(400).json({ success: false, msg: "缺少 serverId" });
  const [rows] = await pool.query(
    "SELECT account,bind_email,commands,interval_sec,loop_count,wait_timeout_ms FROM user_server_configs WHERE user_id=? AND server_id=?",
    [req.user.id, serverId],
  );
  res.json({ success: true, data: rows[0] || {} });
});

router.post("/server-config", async (req, res) => {
  const pool = getPool();
  const c = req.body || {};
  const serverId = Number(c.serverId || 0);
  if (!serverId)
    return res.status(400).json({ success: false, msg: "缺少 serverId" });
  const account = c.account || null;
  const bind_email = c.bind_email || null;
  const commands = c.commands || null;
  const interval_sec = c.interval_sec != null ? Number(c.interval_sec) : null;
  const loop_count = c.loop_count != null ? Number(c.loop_count) : null;
  const wait_timeout_ms =
    c.wait_timeout_ms != null ? Number(c.wait_timeout_ms) : null;
  await pool.query(
    `INSERT INTO user_server_configs (user_id,server_id,account,bind_email,commands,interval_sec,loop_count,wait_timeout_ms)
     VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE account=VALUES(account),bind_email=VALUES(bind_email),commands=VALUES(commands),interval_sec=VALUES(interval_sec),loop_count=VALUES(loop_count),wait_timeout_ms=VALUES(wait_timeout_ms)`,
    [
      req.user.id,
      serverId,
      account,
      bind_email,
      commands,
      interval_sec,
      loop_count,
      wait_timeout_ms,
    ],
  );
  res.json({ success: true });
});

router.get("/groups", async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT slot,name,commands,loop_count FROM user_groups WHERE user_id=? ORDER BY slot ASC",
    [req.user.id],
  );
  const result = [];
  for (let i = 1; i <= 10; i++) {
    const r = rows.find((x) => x.slot === i);
    result.push({
      slot: i,
      name: r?.name || "",
      commands: r?.commands || "",
      loop: r?.loop_count || 1,
    });
  }
  res.json({ success: true, groups: result });
});

router.post("/groups", async (req, res) => {
  const pool = getPool();
  let groups = req.body?.groups;
  if (typeof groups === "string") {
    try {
      groups = JSON.parse(groups);
    } catch {
      groups = [];
    }
  }
  if (!Array.isArray(groups) || groups.length === 0) {
    return res.status(400).json({
      success: false,
      msg: "groups 需要为非空数组（Content-Type: application/json）",
    });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const slot = Number(g.slot || i + 1);
      const name = String(g.name || "");
      const commands = String(g.commands || "");
      const loop = Number(g.loop || g.loop_count || 1) || 1;
      await conn.query(
        "INSERT INTO user_groups (user_id,slot,name,commands,loop_count) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),commands=VALUES(commands),loop_count=VALUES(loop_count)",
        [req.user.id, slot, name, commands, loop],
      );
    }
    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, msg: e.message || String(e) });
  } finally {
    conn.release();
  }
});

router.get("/config", async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT account,passwd,bind_email,commands,interval_sec,loop_count FROM user_configs WHERE user_id=?",
    [req.user.id],
  );
  const row = rows[0] || {};
  res.json({ success: true, data: row });
});

router.post("/config", async (req, res) => {
  const pool = getPool();
  const c = req.body || {};
  const account = c.account || null;
  const passwd = c.passwd || null;
  const bind_email = c.bind_email || null;
  const commands = c.commands || null;
  const interval_sec = c.interval_sec != null ? Number(c.interval_sec) : null;
  const loop_count = c.loop_count != null ? Number(c.loop_count) : null;
  await pool.query(
    "INSERT INTO user_configs (user_id,account,passwd,bind_email,commands,interval_sec,loop_count) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE account=VALUES(account),passwd=VALUES(passwd),bind_email=VALUES(bind_email),commands=VALUES(commands),interval_sec=VALUES(interval_sec),loop_count=VALUES(loop_count)",
    [
      req.user.id,
      account,
      passwd,
      bind_email,
      commands,
      interval_sec,
      loop_count,
    ],
  );
  res.json({ success: true });
});

router.post("/start", async (req, res) => {
  const b = req.body || {};
  const account = String(b.account || "").trim();
  const password = String(b.password || b.passwd || "").trim();
  const email = String(b.email || b.bind_email || "").trim();
  const commands = String(b.commands || "").trim();
  const interval = Number(b.interval || b.interval_sec || "0.5");
  const loopCount = Number(b.loopCount || b.loop_count || "0");
  const respTimeoutSec =
    b.respTimeout != null ? Number(b.respTimeout) : undefined; // seconds
  const serverId = Number(b.serverId || 0);
  if (!account || !password)
    return res
      .status(400)
      .json({ success: false, msg: "游戏账号/密码不能为空" });
  const pool = getPool();
  let [srvRows] = await pool.query(
    "SELECT * FROM mud_servers WHERE id=? LIMIT 1",
    [serverId || null],
  );
  if (!srvRows.length) {
    [srvRows] = await pool.query(
      "SELECT * FROM mud_servers ORDER BY id ASC LIMIT 1",
    );
  }
  if (!srvRows.length) {
    return res
      .status(500)
      .json({ success: false, msg: "未配置可用的游戏服务器" });
  }
  const srv = srvRows[0];
  let respTimeoutSecEff = respTimeoutSec;
  if (respTimeoutSecEff == null) {
    const [cfgRows] = await pool.query(
      "SELECT wait_timeout_ms FROM user_server_configs WHERE user_id=? AND server_id=?",
      [req.user.id, srv.id],
    );
    const ms = cfgRows[0]?.wait_timeout_ms;
    if (ms != null) respTimeoutSecEff = Math.max(0, Number(ms) / 1000);
  }
  const params = {
    account,
    password,
    email,
    commands,
    defaultInterval: interval > 0 ? interval : 0.5,
    loopCount: loopCount >= 0 ? loopCount : 0,
    respTimeoutSec:
      respTimeoutSecEff != null && respTimeoutSecEff > 0
        ? respTimeoutSecEff
        : undefined,
    server: {
      id: srv.id,
      name: srv.name,
      base_host: srv.base_host,
      login_path: srv.login_path,
      check_path: srv.check_path,
      login_params: safeParse(srv.login_params) || {},
      headers: safeParse(srv.headers) || {},
      token_strip_chars: srv.token_strip_chars || "f0",
      default_key: srv.default_key || "",
      default_page: srv.default_page || 1,
    },
  };
  const taskId = await taskManager.startTask(req.user.id, params);
  res.json({ success: true, taskId });
});

router.post("/stop", async (req, res) => {
  const id = String(req.body?.taskId || "").trim();
  if (id) taskManager.stopTask(id);
  res.json({ success: true });
});

router.get("/log", (req, res) => {
  const id = String(req.query?.taskId || "").trim();
  const data = taskManager.getLog(id);
  res.json(data);
});

function safeParse(v) {
  if (!v) return null;
  try {
    if (typeof v === "object") return v;
    return JSON.parse(v);
  } catch {
    return null;
  }
}

module.exports = router;
