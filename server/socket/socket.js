/**
 * socket/socket.js
 * -----------------
 * Socket.io configuration for real-time threat broadcasting.
 *
 * Events emitted to clients:
 *   threat_alert  — fired whenever the ML service detects a threat
 *
 * Authentication:
 *   Clients must pass their JWT in the Socket.io auth handshake:
 *     const socket = io(SERVER_URL, { auth: { token: '<jwt>' } })
 *
 *   Unauthenticated connections are allowed but do not join user rooms,
 *   so they only receive broadcast events (none currently).
 */

const { Server }  = require('socket.io');
const jwt         = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'change_this_secret_in_production';
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',');

/**
 * initSocket
 * ----------
 * Attaches Socket.io to the existing HTTP server.
 *
 * @param {http.Server} httpServer
 * @returns {{ io, emitThreatAlert }}
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin:      CLIENT_ORIGIN,
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    // Prefer WebSocket, fall back to polling
    transports: ['websocket', 'polling'],
  });

  // ── Auth middleware ────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      // Allow anonymous connections for health/monitoring tools
      socket.data.user = null;
      return next();
    }

    try {
      const decoded   = jwt.verify(token, JWT_SECRET);
      socket.data.user = decoded;      // { id, email, role }
      next();
    } catch {
      // Invalid token — still allow the connection but treat as anonymous
      socket.data.user = null;
      next();
    }
  });

  // ── Connection handler ─────────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.data.user;

    if (user) {
      // Join a private room keyed by user ID for targeted broadcasts
      socket.join(`user:${user.id}`);

      // Admins also join the admin room to receive all alerts
      if (user.role === 'admin') {
        socket.join('admin');
      }

      console.log(`[Socket] Connected: ${user.email} (${user.role}) — socket ${socket.id}`);
    } else {
      console.log(`[Socket] Anonymous connection — socket ${socket.id}`);
    }

    socket.on('disconnect', (reason) => {
      const who = user ? user.email : 'anonymous';
      console.log(`[Socket] Disconnected: ${who} — ${reason}`);
    });

    // Ping/pong health check
    socket.on('ping', () => socket.emit('pong', { ts: Date.now() }));
  });

  // ── Emitter used by threatController ──────────────────────
  /**
   * Emit a threat_alert event to:
   *   - The specific user's private room
   *   - All admin sockets
   *
   * @param {object} payload
   * @param {string} payload.threatId
   * @param {string} payload.attack_type
   * @param {string} payload.risk_level
   * @param {number} payload.confidence_score
   * @param {string} payload.source_ip
   * @param {string} payload.timestamp
   * @param {string} payload.userId
   */
  function emitThreatAlert(payload) {
    // Emit to the user who triggered the analysis
    if (payload.userId) {
      io.to(`user:${payload.userId}`).emit('threat_alert', payload);
    }
    // Emit to all admins
    io.to('admin').emit('threat_alert', payload);

    console.log(
      `[Socket] threat_alert → user:${payload.userId} + admin | ` +
      `${payload.attack_type} (${payload.risk_level})`
    );
  }

  return { io, emitThreatAlert };
}

module.exports = initSocket;
