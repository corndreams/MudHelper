function parseCommands(cmdText, globalGroups) {
  const parsed = [];
  const replaced = replaceGlobalGroups(cmdText || "", globalGroups || {});
  const cleaned = cleanEmptyLines(replaced);
  expandLocalGroups(cleaned, parsed);
  return parsed;
}

function replaceGlobalGroups(text, globalGroups) {
  let out = text;
  const map = {};
  Object.values(globalGroups || {}).forEach((g) => {
    if (g && g.name) {
      map[g.name] = {
        commands: g.commands || "",
        loop: Number(g.loop || g.loop_count || 1) || 1,
      };
    }
  });
  out = out.replace(/@([\p{L}\p{N}_]+)/gu, (_, name) => {
    if (!map[name]) return "";
    const body = map[name].commands || "";
    const loop = map[name].loop;
    return Array(loop).fill(body).join("\n");
  });
  // 二次清理：若仍残留形如 @xxx（包含非字母数字的情况），直接移除
  out = out.replace(/@\S+/g, "");
  return out;
}

function cleanEmptyLines(text) {
  return (text || "")
    .split(/\r?\n/)
    .map((s) => s.trimEnd())
    .filter((s) => s.trim().length > 0)
    .join("\n");
}

function expandLocalGroups(text, acc) {
  let lastEnd = 0;
  const re = /\[(\w+):(\d+)\]([\s\S]*?)\[\/\1\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const prefix = text.slice(lastEnd, m.index);
    parseLines(prefix, acc);
    const count = Number(m[2]) || 1;
    for (let i = 0; i < count; i++) {
      expandLocalGroups(m[3], acc);
    }
    lastEnd = m.index + m[0].length;
  }
  const remain = text.slice(lastEnd);
  parseLines(remain, acc);
}

function parseLines(text, acc) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    const info = parseSingle(line);
    if (info) acc.push(info);
  }
}

function parseSingle(line) {
  const parts = line.split("|");
  const cmd = (parts[0] || "").trim();
  if (!cmd) return null;
  let interval = null;
  if (parts.length > 1 && parts[1].trim()) {
    const v = Number(parts[1].trim());
    interval = Number.isFinite(v) && v > 0 ? v : null;
  }
  const keyword = parts.length > 2 && parts[2].trim() ? parts[2].trim() : null;
  return { cmd, interval, keyword };
}

module.exports = { parseCommands };
