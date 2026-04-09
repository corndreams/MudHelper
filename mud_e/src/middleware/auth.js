const jwt = require("jsonwebtoken");

function verifyToken(token) {
  try {
    const secret = process.env.JWT_SECRET || "dev_secret";
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ success: false, msg: "未授权" });
  const payload = verifyToken(m[1]);
  if (!payload) return res.status(401).json({ success: false, msg: "令牌无效" });
  req.user = { id: payload.uid, email: payload.email };
  next();
}

module.exports = { authMiddleware, verifyToken };
