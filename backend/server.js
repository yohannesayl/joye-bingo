import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { RoomManager } from './roomManager.js';
import { generateBingoCard } from './gameEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const roomManager = new RoomManager(io);

db.onConnectCallback = () => {
  console.log('🔄 Syncing room states to MongoDB Atlas database...');
  roomManager.initDefaultRooms();
};

// REST API HEALTH ROUTE
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Joye Bingo API', db: 'Joye-bingo', version: '1.0.0', time: new Date() });
});

// AUTH: REGISTER USER TO MONGO DATABASE
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, username, phone, password } = req.body;
    if (!username || !phone || !password) {
      return res.status(400).json({ error: 'Username, phone number, and password are required!' });
    }

    const user = await db.registerUser({ fullName, username, phone, password });
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// AUTH: LOGIN USER FROM MONGO DATABASE
app.post('/api/auth/login', async (req, res) => {
  try {
    const { loginInput, password, userId, username, displayName } = req.body;

    if (loginInput) {
      const user = await db.authenticateUser({ loginInput, password });
      return res.json({ success: true, user });
    }

    const targetId = userId || `user_${Date.now()}`;
    let user = await db.getUser(targetId);

    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: GET ALL REGISTERED USERS FROM MONGO DATABASE
app.get('/api/admin/users', async (req, res) => {
  const users = await db.getAllUsers();
  res.json({ users });
});

// ADMIN: UPDATE USER BALANCE IN MONGO DATABASE
app.post('/api/admin/user-balance', async (req, res) => {
  const { userId, delta } = req.body;
  const newBalance = await db.updateBalance(userId, delta);
  res.json({ success: true, balance: newBalance });
});

// ADMIN: BLOCK / UNBLOCK USER IN MONGO DATABASE
app.post('/api/admin/toggle-block', async (req, res) => {
  const { userId } = req.body;
  const user = await db.toggleBlockUser(userId);
  res.json({ success: true, user });
});

// Wallet balance & details
app.get('/api/wallet/:userId', async (req, res) => {
  const user = await db.getUser(req.params.userId);
  const transactions = await db.getTransactions(req.params.userId);
  res.json({
    balance: user?.balance || 100,
    referralCode: user?.referralCode || 'JOYE100',
    transactions
  });
});

// Instant 1-Click Free Coins for testing
app.post('/api/wallet/free-coins', async (req, res) => {
  const { userId } = req.body;
  const newBalance = await db.updateBalance(userId, 1000);
  const tx = await db.addTransaction({
    userId,
    type: 'DEPOSIT',
    method: 'Free Test Bonus',
    amount: 1000,
    reference: 'TEST-BONUS-1000'
  });
  res.json({ success: true, balance: newBalance, transaction: tx });
});

// Mock Deposit / Withdraw API (Telebirr & CBE Birr)
app.post('/api/wallet/deposit', async (req, res) => {
  const { userId, amount, method, reference } = req.body;
  const numAmt = parseFloat(amount);

  if (!numAmt || numAmt <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  const newBalance = await db.updateBalance(userId, numAmt);
  const tx = await db.addTransaction({
    userId,
    type: 'DEPOSIT',
    method: method || 'Telebirr',
    amount: numAmt,
    reference: reference || `TLB-${Math.floor(10000000 + Math.random() * 90000000)}`
  });

  res.json({ success: true, balance: newBalance, transaction: tx });
});

app.post('/api/wallet/withdraw', async (req, res) => {
  const { userId, amount, method, phoneNumber } = req.body;
  const numAmt = parseFloat(amount);
  const user = await db.getUser(userId);

  if (!numAmt || numAmt <= 0) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' });
  }

  if ((user?.balance || 0) < numAmt) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  const newBalance = await db.updateBalance(userId, -numAmt);
  const tx = await db.addTransaction({
    userId,
    type: 'WITHDRAWAL',
    method: method || 'Telebirr',
    amount: numAmt,
    reference: `WTH-${phoneNumber || '251911000000'}`
  });

  res.json({ success: true, balance: newBalance, transaction: tx });
});

// Leaderboard & History
app.get('/api/leaderboard', async (req, res) => {
  const leaderboard = await db.getLeaderboard();
  const recentGames = await db.getGameHistory();
  res.json({
    leaderboard,
    recentGames
  });
});

// Preview Card API
app.get('/api/card/:cardId', (req, res) => {
  const cardId = parseInt(req.params.cardId, 10);
  if (isNaN(cardId) || cardId < 1 || cardId > 100) {
    return res.status(400).json({ error: 'Card ID must be between 1 and 100' });
  }
  const card = generateBingoCard(cardId);
  res.json(card);
});

// SERVE FRONTEND STATIC PRODUCTION BUNDLE IF PRESENT (Allows 1-Service Render Deployment!)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  console.log('📦 Serving production frontend static bundle from:', frontendDistPath);
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // ROOT LANDING PAGE FOR BACKEND SERVER
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Joye Bingo Backend API (MongoDB)</title>
          <style>
            body { font-family: 'Outfit', sans-serif; text-align: center; padding: 50px; background: #200936; color: #fff; }
            h1 { color: #ffce00; }
            .status { color: #4ade80; font-weight: bold; font-size: 1.2rem; }
            a { color: #ffce00; text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>🎯 Joye Bingo Backend API & MongoDB Atlas Server</h1>
          <p class="status">✅ MongoDB Database (Joye-bingo): CONNECTED & LIVE</p>
          <p>Real-time Socket.io match coordinator and MongoDB user database is running.</p>
          <p><a href="/api/health">Check /api/health endpoint</a></p>
        </body>
      </html>
    `);
  });
}

// SOCKET.IO REALTIME EVENTS
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.emit('lobby_list', roomManager.getRoomList());

  // NTP Clock Ping Endpoint matching user script
  socket.on('sync_clock', (clientPingTime, callback) => {
    if (typeof callback === 'function') {
      callback({
        clientPingTime,
        serverTime: Date.now()
      });
    }
  });

  socket.on('join_match', async (userData) => {
    try {
      const roomId = userData?.roomId || 'room_10';
      const res = await roomManager.joinRoom(socket, roomId, userData);
      if (res && res.error) socket.emit('error_msg', res.error);
    } catch (e) {
      console.error('[Socket] Error in join_match:', e);
    }
  });

  socket.on('join_room', async ({ roomId, user }) => {
    try {
      const res = await roomManager.joinRoom(socket, roomId || 'room_10', user);
      if (res && res.error) socket.emit('error_msg', res.error);
    } catch (e) {
      console.error('[Socket] Error in join_room:', e);
    }
  });

  socket.on('join_queue', async ({ roomId = 'room_10', user }) => {
    try {
      const res = await roomManager.joinRoom(socket, roomId, user);
      if (res && res.error) socket.emit('error_msg', res.error);
    } catch (e) {
      console.error('[Socket] Error in join_queue:', e);
    }
  });

  socket.on('leave_room', ({ roomId }) => {
    try {
      roomManager.leaveRoom(socket, roomId);
    } catch (e) {
      console.error('[Socket] Error in leave_room:', e);
    }
  });

  socket.on('buy_card', async ({ roomId, userId, cardId }) => {
    try {
      const res = await roomManager.buyCard(socket, roomId, userId, cardId);
      if (res && res.error) {
        socket.emit('error_msg', res.error);
      } else {
        socket.emit('card_bought', res);
      }
    } catch (e) {
      console.error('[Socket] Error in buy_card:', e);
    }
  });

  socket.on('claim_bingo', async ({ roomId, userId, cardId }) => {
    try {
      const res = await roomManager.claimBingo(socket, roomId, userId, cardId);
      if (res && res.error) {
        socket.emit('error_msg', res.error);
      }
    } catch (e) {
      console.error('[Socket] Error in claim_bingo:', e);
    }
  });

  socket.on('add_bot_player', ({ roomId }) => {
    try {
      roomManager.addBotToRoom(roomId);
    } catch (e) {}
  });

  // Host Controls
  socket.on('host_draw_ball', ({ roomId }) => {
    const ball = roomManager.drawNextBall(roomId);
    if (!ball) socket.emit('error_msg', 'Cannot draw ball: Game not active or all balls drawn.');
  });

  socket.on('host_set_speed', ({ roomId, speedMs }) => {
    roomManager.setCallSpeed(roomId, speedMs);
  });

  socket.on('host_toggle_autocall', ({ roomId, enabled }) => {
    roomManager.toggleAutocall(roomId, enabled);
  });

  socket.on('host_reset_room', ({ roomId }) => {
    roomManager.resetRoom(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Joye Bingo Backend (MongoDB Atlas) running on http://localhost:${PORT}`);
});
