const { Server } = require("ws");

let wss;
const subscribers = new Map();

function setupWebSocket(server) {
  wss = new Server({ server, path: "/ws" });
  wss.on("connection", ws => {
    ws.on("message", msg => {
      try {
        const data = JSON.parse(msg.toString());
        if (data && data.type === "subscribe" && data.taskId) {
          subscribers.set(ws, data.taskId);
        }
      } catch {}
    });
    ws.on("close", () => {
      subscribers.delete(ws);
    });
  });
}

function broadcastLog(taskId, payload) {
  for (const [ws, tid] of subscribers.entries()) {
    if (tid === taskId && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(payload));
      } catch {}
    }
  }
}

module.exports = { setupWebSocket, broadcastLog };
