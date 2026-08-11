import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { db } from './db.js';
import { RoomManager } from './roomManager.js';
import { generateBingoCard } from './gameEngine.js';

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

// ROOT LANDING PAGE FOR BACKEND SERVER
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Joye Bingo Backend API</title>
        <style>
          body { font-family: 'Outfit', sans-serif; text-align: center; padding: 50px; background: #200936; color: #fff; }
          h1 { color: #ffce00; }
          .status { color: #4ade80; font-weight: bold; font-size: 1.2rem; }
          a { color: #ffce00; text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>🎯 Joye Bingo Backend API & WebSocket Server</h1>
        <p class="status">✅ Server Status: LIVE & HEALTHY</p>
        <p>Real-time Socket.io match coordinator and database API is running.</p>
        <p><a href="/api/health">Check /api/health endpoint</a></p>
      </body>
    </html>
  `);
});

// REST API ROUTES
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Joye Bingo API', version: '1.0.0', time: new Date() });
});

// AUTH: REGISTER USER TO DATABASE
app.post('/api/auth/register', (req, res) => {
  try {
    const { fullName, username, phone, password } = req.body;
    if (!username || !phone || !password) {
      return res.status(400).json({ error: 'Username, phone number, and password are required!' });
    }

    const user = db.registerUser({ fullName, username, phone, password });
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// AUTH: LOGIN USER FROM DATABASE
app.post('/api/auth/login', (req, res) => {
  try {
    const { loginInput, password, userId, username, displayName } = req.body;

    if (loginInput) {
      const user = db.authenticateUser({ loginInput, password });
      return res.json({ success: true, user });
    }

    const targetId = userId || `user_${Date.now()}`;
    let user = db.getUser(targetId);

    if (username || displayName) {
      user = db.updateUser(targetId, {
        username: username || user.username,
        displayName: displayName || user.displayName
      });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: GET ALL REGISTERED USERS FROM DATABASE
app.get('/api/admin/users', (req, res) => {
  const users = db.getAllUsers();
  res.json({ users });
});

// ADMIN: UPDATE USER BALANCE IN DATABASE
app.post('/api/admin/user-balance', (req, res) => {
  const { userId, delta } = req.body;
  const newBalance = db.updateBalance(userId, delta);
  res.json({ success: true, balance: newBalance });
});

// ADMIN: BLOCK / UNBLOCK USER IN DATABASE
app.post('/api/admin/toggle-block', (req, res) => {
  const { userId } = req.body;
  const user = db.toggleBlockUser(userId);
  res.json({ success: true, user });
});

// Wallet balance & details
app.get('/api/wallet/:userId', (req, res) => {
  const user = db.getUser(req.params.userId);
  const transactions = db.getTransactions(req.params.userId);
  res.json({
    balance: user.balance,
    referralCode: user.referralCode,
    transactions
  });
});

// Instant 1-Click Free Coins for testing
app.post('/api/wallet/free-coins', (req, res) => {
  const { userId } = req.body;
  const newBalance = db.updateBalance(userId, 1000);
  const tx = db.addTransaction({
    userId,
    type: 'DEPOSIT',
    method: 'Free Test Bonus',
    amount: 1000,
    reference: 'TEST-BONUS-1000'
  });
  res.json({ success: true, balance: newBalance, transaction: tx });
});

// Mock Deposit / Withdraw API (Telebirr & CBE Birr)
app.post('/api/wallet/deposit', (req, res) => {
  const { userId, amount, method, reference } = req.body;
  const numAmt = parseFloat(amount);

  if (!numAmt || numAmt <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  const newBalance = db.updateBalance(userId, numAmt);
  const tx = db.addTransaction({
    userId,
    type: 'DEPOSIT',
    method: method || 'Telebirr',
    amount: numAmt,
    reference: reference || `TLB-${Math.floor(10000000 + Math.random() * 90000000)}`
  });

  res.json({ success: true, balance: newBalance, transaction: tx });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const { userId, amount, method, phoneNumber } = req.body;
  const numAmt = parseFloat(amount);
  const user = db.getUser(userId);

  if (!numAmt || numAmt <= 0) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' });
  }

  if (user.balance < numAmt) {
    return res.status(400).json({ error: 'Insufficient wallet balance' });
  }

  const newBalance = db.updateBalance(userId, -numAmt);
  const tx = db.addTransaction({
    userId,
    type: 'WITHDRAWAL',
    method: method || 'Telebirr',
    amount: numAmt,
    reference: `WTH-${phoneNumber || '251911000000'}`
  });

  res.json({ success: true, balance: newBalance, transaction: tx });
});

// Leaderboard & History
app.get('/api/leaderboard', (req, res) => {
  res.json({
    leaderboard: db.getLeaderboard(),
    recentGames: db.getGameHistory()
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

// SOCKET.IO REALTIME EVENTS
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.emit('lobby_list', roomManager.getRoomList());

  socket.on('join_room', ({ roomId, user }) => {
    const res = roomManager.joinRoom(socket, roomId, user);
    if (res.error) socket.emit('error_msg', res.error);
  });

  socket.on('leave_room', ({ roomId }) => {
    roomManager.leaveRoom(socket, roomId);
  });

  socket.on('buy_card', ({ roomId, userId, cardId }) => {
    const res = roomManager.buyCard(socket, roomId, userId, cardId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      socket.emit('card_bought', res);
    }
  });

  socket.on('claim_bingo', ({ roomId, userId, cardId }) => {
    const res = roomManager.claimBingo(socket, roomId, userId, cardId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    }
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
  console.log(`🚀 Joye Bingo Backend running on http://localhost:${PORT}`);
});
