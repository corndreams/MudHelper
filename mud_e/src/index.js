const http = require("http");
const net = require("net");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { initDatabase } = require("./db/mysql");
const authRoutes = require("./routes/auth");
const mudRoutes = require("./routes/mud");
const { setupWebSocket } = require("./services/ws");

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const rawOrigins = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (rawOrigins.includes("*") || rawOrigins.includes(origin))
      return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes.router);
app.use("/mud", mudRoutes);

const server = http.createServer(app);

const BASE_PORT = Number(process.env.PORT || 3001);

function findFreePort(start, maxTries = 20) {
  return new Promise((resolve, reject) => {
    let port = start;
    let tries = 0;
    const tryNext = () => {
      if (tries >= maxTries) return reject(new Error("No free port found"));
      tries++;
      const tester = net
        .createServer()
        .once("error", () => {
          port++;
          tryNext();
        })
        .once("listening", () => {
          tester.once("close", () => resolve(port)).close();
        })
        .listen(port, "0.0.0.0");
    };
    tryNext();
  });
}

async function start() {
  try {
    await initDatabase();
  } catch {}
  let port;
  try {
    port = await findFreePort(BASE_PORT);
  } catch {
    port = 0;
  }
  server.listen(port, "0.0.0.0", () => {
    const addr = server.address();
    if (addr && typeof addr === "object") {
      console.log(`Server listening on http://localhost:${addr.port}`);
    }
    setupWebSocket(server);
  });
}

start();

module.exports = app;
