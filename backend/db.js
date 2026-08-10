import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data.json');

// Default initial state with real seed users and exact balances
const defaultData = {
  users: {
    'user_1': {
      id: 'user_1',
      username: 'Abebe_Bingo',
      displayName: 'Abebe B.',
      phone: '0911223344',
      password: 'password123',
      balance: 250,
      referralCode: 'JOYE100',
      totalWins: 14,
      totalEarned: 1850,
      gamesPlayed: 32,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString()
    },
    'user_2': {
      id: 'user_2',
      username: 'Tigist_K',
      displayName: 'Tigist K.',
      phone: '0922334455',
      password: 'password123',
      balance: 500,
      referralCode: 'JOYE200',
      totalWins: 22,
      totalEarned: 3400,
      gamesPlayed: 45,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString()
    },
    'user_3': {
      id: 'user_3',
      username: 'Kebede_Master',
      displayName: 'Kebede M.',
      phone: '0933445566',
      password: 'password123',
      balance: 150,
      referralCode: 'JOYE300',
      totalWins: 8,
      totalEarned: 920,
      gamesPlayed: 18,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString()
    }
  },
  transactions: [],
  gameHistory: []
};

class Database {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileData = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(fileData);
      }
    } catch (err) {
      console.error('Error loading DB, using defaults:', err);
    }
    return defaultData;
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('Error saving DB:', err);
    }
  }

  getAllUsers() {
    return Object.values(this.data.users);
  }

  getUser(userId) {
    if (!userId) return null;
    if (!this.data.users[userId]) {
      const guestId = userId;
      this.data.users[guestId] = {
        id: guestId,
        username: `Player_${guestId.slice(-4)}`,
        displayName: `Player #${guestId.slice(-4)}`,
        phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        balance: 100, // REAL INITIAL STARTING BALANCE 100 ETB!
        referralCode: `JOYE${Math.floor(100 + Math.random() * 900)}`,
        totalWins: 0,
        totalEarned: 0,
        gamesPlayed: 0,
        status: 'ACTIVE',
        joinedAt: new Date().toISOString()
      };
      this.save();
    }
    return this.data.users[userId];
  }

  // SIGN UP / REGISTER NEW PLAYER TO REAL DATABASE
  registerUser({ fullName, username, phone, password }) {
    const usersList = Object.values(this.data.users);

    const existingUsername = usersList.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUsername) {
      throw new Error('Username is already registered! Please choose a different username.');
    }

    const existingPhone = usersList.find(u => u.phone === phone);
    if (existingPhone) {
      throw new Error('Phone number is already registered! Please log in.');
    }

    const userId = `user_${Date.now()}`;
    const newUser = {
      id: userId,
      username,
      displayName: fullName || username,
      phone,
      password: password || '123456',
      balance: 100, // REAL 100 ETB WELCOME BONUS
      referralCode: `JOYE${Math.floor(1000 + Math.random() * 9000)}`,
      totalWins: 0,
      totalEarned: 0,
      gamesPlayed: 0,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString()
    };

    this.data.users[userId] = newUser;
    this.save();
    return newUser;
  }

  // SIGN IN / AUTHENTICATE USER FROM REAL DATABASE
  authenticateUser({ loginInput, password }) {
    const usersList = Object.values(this.data.users);
    const user = usersList.find(u =>
      (u.username.toLowerCase() === loginInput.toLowerCase() || u.phone === loginInput)
    );

    if (!user) {
      throw new Error('User not found! Please check your username or phone number.');
    }

    if (user.status === 'BLOCKED') {
      throw new Error('Your account has been suspended by Admin. Please contact support.');
    }

    if (user.password && password && user.password !== password) {
      throw new Error('Incorrect password! Please try again.');
    }

    return user;
  }

  updateUser(userId, updates) {
    if (this.data.users[userId]) {
      this.data.users[userId] = { ...this.data.users[userId], ...updates };
      this.save();
    }
    return this.data.users[userId];
  }

  updateBalance(userId, delta) {
    const user = this.getUser(userId);
    if (user) {
      user.balance = Math.max(0, user.balance + delta);
      this.save();
    }
    return user?.balance || 0;
  }

  toggleBlockUser(userId) {
    const user = this.data.users[userId];
    if (user) {
      user.status = user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
      this.save();
    }
    return user;
  }

  addTransaction(tx) {
    const newTx = {
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      ...tx
    };
    this.data.transactions.unshift(newTx);
    this.save();
    return newTx;
  }

  addGameHistory(record) {
    const newRecord = {
      id: `game_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...record
    };
    this.data.gameHistory.unshift(newRecord);
    this.save();
    return newRecord;
  }

  getLeaderboard() {
    return Object.values(this.data.users)
      .sort((a, b) => (b.totalEarned || 0) - (a.totalEarned || 0))
      .slice(0, 20);
  }

  getGameHistory() {
    return this.data.gameHistory.slice(0, 15);
  }

  getTransactions(userId) {
    return this.data.transactions.filter(t => t.userId === userId).slice(0, 20);
  }
}

export const db = new Database();
