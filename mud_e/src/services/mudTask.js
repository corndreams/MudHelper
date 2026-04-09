const net = require("net");
const axios = require("axios");
const iconv = require("iconv-lite");
const { v4: uuidv4 } = require("uuid");
const { parseCommands } = require("./parser");
const { broadcastLog } = require("./ws");
const { getPool } = require("../db/mysql");

const TCP_ENC = "gbk";

class Task {
  constructor(userId, params) {
    this.userId = userId;
    this.params = params;
    this.id = uuidv4();
    this.running = false;
    this.log = "";
    this.firstLoopStart = null;
    this.firstLoopDone = false;
    this.timerText = "首次循环耗时：--";
    this.lastResp = "";
    this.socket = null;
    this.gameHost = null;
    this.gamePort = null;
    this.sessionKey = null;
    this.respTimeoutMs = Math.max(
      0,
      Math.round((params.respTimeoutSec || 0.5) * 1000),
    );
    this.srv = params.server;
  }
  addLog(t) {
    const ts = new Date().toTimeString().slice(0, 8);
    this.log += `[${ts}] ${t}\n`;
    const lines = this.log.split("\n");
    if (lines.length > 1500) this.log = lines.slice(-800).join("\n");
    broadcastLog(this.id, {
      type: "log",
      log: this.log,
      timer: this.timerText,
      taskId: this.id,
    });
  }
  async readOnce(timeoutMs = 3000) {
    return new Promise((resolve) => {
      let done = false;
      const onData = (buf) => {
        if (done) return;
        done = true;
        resolve(iconv.decode(buf, TCP_ENC));
      };
      const to = setTimeout(() => {
        if (done) return;
        done = true;
        resolve("");
      }, timeoutMs);
      this.socket.once("data", (buf) => {
        clearTimeout(to);
        onData(buf);
      });
    });
  }
  async readBurst(firstTimeoutMs = 1200, burstMs = 150) {
    return new Promise((resolve) => {
      const chunks = [];
      let timer = setTimeout(() => {
        cleanup();
        resolve(iconv.decode(Buffer.concat(chunks), TCP_ENC));
      }, firstTimeoutMs);
      const onData = (buf) => {
        chunks.push(buf);
        clearTimeout(timer);
        timer = setTimeout(() => {
          cleanup();
          resolve(iconv.decode(Buffer.concat(chunks), TCP_ENC));
        }, burstMs);
      };
      const cleanup = () => {
        this.socket.removeListener("data", onData);
      };
      this.socket.on("data", onData);
    });
  }
  async executeCommands(list, defaultInterval) {
    let executed = 0;
    let skipped = 0;
    for (let i = 0; i < list.length; i++) {
      if (!this.running) break;
      const info = list[i];
      const cmd = info.cmd;
      const interval = info.interval || defaultInterval;
      const keyword = info.keyword;
      if (keyword && (!this.lastResp || !this.lastResp.includes(keyword))) {
        this.addLog(`跳过第${i + 1}条：${cmd}（未匹配关键词「${keyword}」）`);
        skipped++;
        continue;
      }
      executed++;
      this.addLog(`\n===== 执行第${i + 1}条：${cmd} =====`);
      try {
        const readP = this.readBurst(this.respTimeoutMs || 1200, 150);
        this.socket.write(iconv.encode(`${cmd}\r\n`, TCP_ENC));
        const resp = await readP;
        this.lastResp = resp || "";
        const show = (resp || "").trim();
        this.addLog(`执行结果：${show}`);
        if (!show) {
          this.addLog(`提示：未在${(this.respTimeoutMs || 1200)}ms 内收到返回或内容为空`);
        }
      } catch (e) {
        this.addLog(`执行指令失败：${e.message || String(e)}`);
        this.lastResp = "";
      }
      this.addLog(`等待${interval}秒...`);
      await new Promise((r) => setTimeout(r, Math.max(0, interval * 1000)));
    }
    return { executed, skipped };
  }
  async run() {
    try {
      this.running = true;
      this.addLog("开始验证游戏账号...");
      const srv = this.srv;
      const headers = Object.assign(
        { Connection: "Keep-Alive" },
        srv?.headers && typeof srv.headers === "object" ? srv.headers : {},
      );
      const lp =
        srv?.login_params && typeof srv.login_params === "object"
          ? srv.login_params
          : { id: "id", pass: "pass", key: "key", page: "page" };
      const loginParams = {};
      loginParams[lp.id || "id"] = this.params.account;
      loginParams[lp.pass || "pass"] = this.params.password;
      if (lp.key) loginParams[lp.key] = srv?.default_key || "";
      if (lp.page) loginParams[lp.page] = srv?.default_page || 1;
      const baseHost = srv?.base_host;
      const loginUrl = `http://${baseHost}${srv?.login_path || "/mobi/loginto.php"}`;
      const checkUrl = `http://${baseHost}${srv?.check_path || "/mobi/check.php"}`;
      const resp = await axios.get(loginUrl, {
        params: loginParams,
        headers,
        timeout: 15000,
        responseType: "text",
      });
      const loginRaw = String(resp.data || "").trim();
      this.addLog(`登录接口返回：${loginRaw.slice(0, 50)}...`);
      const parsed = parseLoginInfo(loginRaw);
      if (!parsed) {
        this.addLog("登录失败：未能解析登录返回");
        this.running = false;
        return;
      }
      this.gameHost = parsed.host;
      this.gamePort = parsed.port;
      this.sessionKey = parsed.sessionKey;
      this.addLog(`解析游戏服成功：${this.gameHost}:${this.gamePort}`);
      this.addLog("正在获取游戏服验证令牌...");
      const cParams = {
        ip: this.gameHost,
        port: this.gamePort,
        key: this.sessionKey,
      };
      const cResp = await axios.get(checkUrl, {
        params: cParams,
        headers,
        timeout: 15000,
        responseType: "text",
      });
      const rawToken = String(cResp.data || "").trim();
      const strip = (srv?.token_strip_chars || "f0").replace(
        /[^a-zA-Z0-9]/g,
        "",
      );
      const regex = new RegExp("[" + strip + "]", "g");
      const checkToken = rawToken.replace(regex, "").trim();
      if (!checkToken) {
        this.addLog("获取令牌失败：令牌为空");
        this.running = false;
        return;
      }
      this.addLog(`令牌获取成功：${checkToken}`);
      this.addLog(`正在连接游戏服 ${this.gameHost}:${this.gamePort}...`);
      this.socket = new net.Socket();
      this.socket.setTimeout(30000);
      await new Promise((resolve, reject) => {
        this.socket.once("error", reject);
        this.socket.connect(this.gamePort, this.gameHost, resolve);
      });
      this.addLog("游戏服连接成功");
      await new Promise((r) => setTimeout(r, 2000));
      const ver = await this.readOnce(4000);
      this.addLog(`游戏服版本信息：${(ver || "").trim().slice(0, 50)}`);
      this.lastResp = ver || "";
      this.socket.write(iconv.encode(`${checkToken}\r\n`, TCP_ENC));
      await new Promise((r) => setTimeout(r, 2000));
      this.addLog("验证令牌发送完成");
      const authStr = `${this.params.account}║${this.params.password}║${checkToken}║${this.params.email || ""}`;
      this.socket.write(iconv.encode(`${authStr}\r\n`, TCP_ENC));
      await new Promise((r) => setTimeout(r, 4000));
      const loginResp = await this.readOnce(6000);
      this.addLog(`游戏服登录响应：${(loginResp || "").trim().slice(0, 50)}`);
      this.lastResp = loginResp || "";
      this.addLog("开始解析指令（含专属组）...");
      const groups = await loadUserGroups(this.userId);
      const groupNames = groups
        .filter((g) => g.name && g.name.trim())
        .map((g) => `${g.name}x${g.loop_count || 1}`);
      this.addLog(
        `专属组加载：${groupNames.length ? groupNames.join(", ") : "无"}`,
      );
      const parsedList = parseCommands(
        this.params.commands || "",
        toGroupMap(groups),
      );
      this.addLog(`指令解析完成，共生成${parsedList.length}条执行指令`);
      const defaultInterval = this.params.defaultInterval || 0.5;
      const loopCount = this.params.loopCount || 0;
      this.addLog(
        `开始执行指令，全局循环次数：${loopCount === 0 ? "无限" : loopCount}`,
      );
      let currentLoop = 0;
      while (this.running) {
        currentLoop++;
        this.addLog(
          `\n============= 全局第${currentLoop}轮执行 ==============`,
        );
        if (currentLoop === 1 && !this.firstLoopDone) {
          this.firstLoopStart = Date.now();
          this.addLog("开始首次循环计时...");
        }
        const { executed, skipped } = await this.executeCommands(
          parsedList,
          defaultInterval,
        );
        if (currentLoop === 1 && !this.firstLoopDone) {
          this.firstLoopDone = true;
          const totalMs = Date.now() - this.firstLoopStart;
          const total = Math.round(totalMs / 10) / 100;
          const mins = Math.floor(total / 60);
          const secs = Math.round((total - mins * 60) * 100) / 100;
          this.timerText = `首次循环耗时：${total}秒（${mins}分${secs}秒）`;
          this.addLog(`首次循环完成！总耗时：${total}秒`);
          this.addLog(`本轮统计：执行${executed}条 | 跳过${skipped}条`);
        }
        if (loopCount > 0 && currentLoop >= loopCount) {
          this.addLog(`已完成全局循环次数（${loopCount}轮），任务即将停止`);
          this.running = false;
          break;
        }
        if (this.running) {
          this.addLog(`全局第${currentLoop}轮结束，1秒后开始下一轮...`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } catch (e) {
      this.addLog(`执行异常：${e.message || String(e)}`);
    } finally {
      this.running = false;
      if (this.socket) {
        try {
          this.socket.end();
          this.socket.destroy();
        } catch {}
      }
      this.addLog("任务执行结束");
    }
  }
}

function parseLoginInfo(text) {
  if (!text) return null;
  let s = String(text).trim();
  // 常见返回可能前缀杂噪，截取第一个出现的 IP&port 样式
  const ipPortRe =
    /((?:\d{1,3}\.){3}\d{1,3})&(\d{2,5})&([^&]*)?&?([^&]*)?&?([^&\s]*)/;
  const m = s.match(ipPortRe);
  if (m) {
    const host = m[1];
    const port = Number(m[2]);
    const sessionKey = m[5] || m[3] || "";
    if (host && Number.isFinite(port)) return { host, port, sessionKey };
  }
  if (s.includes("]")) {
    s = s.split("]").pop().trim();
    if (s.startsWith("&")) s = s.slice(1);
  }
  if (s.includes("&")) {
    const parts = s.split("&");
    if (parts.length >= 2) {
      const host = parts[0];
      const port = Number(parts[1]);
      const sessionKey = parts[4] || "";
      if (host && Number.isFinite(port)) return { host, port, sessionKey };
    }
  }
  return null;
}

function toGroupMap(rows) {
  const obj = {};
  for (const r of rows) {
    const key = `group${r.slot}`;
    obj[key] = {
      name: r.name || "",
      commands: r.commands || "",
      loop: r.loop_count || 1,
    };
  }
  return obj;
}

async function loadUserGroups(userId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT slot,name,commands,loop_count FROM user_groups WHERE user_id = ? ORDER BY slot ASC",
    [userId],
  );
  const need = [];
  for (let i = 1; i <= 10; i++) {
    const r = rows.find((x) => x.slot === i);
    if (r) need.push(r);
    else need.push({ slot: i, name: "", commands: "", loop_count: 1 });
  }
  return need;
}

class TaskManager {
  constructor() {
    this.tasks = new Map();
  }
  async startTask(userId, params) {
    const task = new Task(userId, params);
    this.tasks.set(task.id, task);
    const pool = getPool();
    try {
      await pool.query("INSERT INTO tasks (id,user_id,status) VALUES (?,?,?)", [
        task.id,
        userId,
        "running",
      ]);
    } catch {}
    task.running = true;
    task.run().then(async () => {
      try {
        await pool.query("UPDATE tasks SET status=? WHERE id=?", [
          task.running ? "running" : "stopped",
          task.id,
        ]);
      } catch {}
    });
    return task.id;
  }
  stopTask(taskId) {
    const t = this.tasks.get(taskId);
    if (t) t.running = false;
  }
  getLog(taskId) {
    const t = this.tasks.get(taskId);
    if (!t) return { log: "", timer: "首次循环耗时：--" };
    return { log: t.log, timer: t.timerText };
  }
}

const taskManager = new TaskManager();

module.exports = { taskManager };
