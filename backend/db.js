import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data.json');

// MongoDB Atlas URI with provided credentials
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://yohannesayalew99_db_user:3QBaURuEDMP2pK9q@cluster0.mongodb.net/joye-bingo?retryWrites=true&w=majority';

let isMongoConnected = false;

// 1. MONGOOSE USER SCHEMA & MODEL
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, required: true, unique: true, trim: true },
  fullName: { type: String, default: '' },
  displayName: { type: String, default: '' },
  balance: { type: Number, default: 100 }, // REAL STARTING BALANCE 100 ETB
  referralCode: { type: String, default: '' },
  totalWins: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  status: { type: String, default: 'ACTIVE' },
  joinedAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, required: true },
  method: { type: String, default: 'Telebirr' },
  amount: { type: Number, required: true },
  reference: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const gameHistorySchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  stake: { type: Number, required: true },
  winnerName: { type: String, required: true },
  winnerId: { type: String, required: true },
  prize: { type: Number, required: true },
  calledCount: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const GameHistory = mongoose.model('GameHistory', gameHistorySchema);

class DatabaseService {
  constructor() {
    this.connectMongo();
    this.localData = this.loadLocal();
  }

  async connectMongo() {
    try {
      console.log('🔄 Connecting to MongoDB Atlas (joye-bingo)...');
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      isMongoConnected = true;
      console.log('✅ Connected successfully to MongoDB Atlas (joye-bingo database)!');
    } catch (err) {
      console.warn('⚠️ MongoDB connection warning (Falling back to persistent JSON storage):', err.message);
      isMongoConnected = false;
    }
  }

  loadLocal() {
    try {
      if (fs.existsSync(DB_FILE)) {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      }
    } catch (e) {}
    return { users: {}, transactions: [], gameHistory: [] };
  }

  saveLocal() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.localData, null, 2));
    } catch (e) {}
  }

  // GET ALL USERS FOR HOST MANAGEMENT DASHBOARD
  async getAllUsers() {
    if (isMongoConnected) {
      try {
        const users = await User.find({}).lean();
        return users.map(u => ({ ...u, id: u._id.toString() }));
      } catch (e) {}
    }
    return Object.values(this.localData.users);
  }

  // GET SINGLE USER BY ID
  async getUser(userId) {
    if (!userId) return null;

    if (isMongoConnected) {
      try {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const user = await User.findById(userId).lean();
          if (user) return { ...user, id: user._id.toString() };
        }
        const userByUsername = await User.findOne({ username: userId }).lean();
        if (userByUsername) return { ...userByUsername, id: userByUsername._id.toString() };
      } catch (e) {}
    }

    if (this.localData.users[userId]) {
      return this.localData.users[userId];
    }

    // Guest fallback
    const guestUser = {
      id: userId,
      username: `Player_${userId.slice(-4)}`,
      displayName: `Player #${userId.slice(-4)}`,
      phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: '123',
      balance: 100,
      totalWins: 0,
      totalEarned: 0,
      gamesPlayed: 0,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString()
    };
    this.localData.users[userId] = guestUser;
    this.saveLocal();
    return guestUser;
  }

  // REGISTER NEW USER TO MONGO DB
  async registerUser({ fullName, username, phone, password }) {
    if (isMongoConnected) {
      const existingUser = await User.findOne({
        $or: [
          { username: new RegExp(`^${username}$`, 'i') },
          { phone: phone }
        ]
      });

      if (existingUser) {
        if (existingUser.username.toLowerCase() === username.toLowerCase()) {
          throw new Error('Username is already registered in MongoDB! Please log in or pick another username.');
        }
        throw new Error('Phone number is already registered in MongoDB! Please log in.');
      }

      const newUser = new User({
        username,
        password,
        phone,
        fullName: fullName || username,
        displayName: fullName || username,
        balance: 100, // 100 ETB WELCOME BONUS
        referralCode: `JOYE${Math.floor(1000 + Math.random() * 9000)}`
      });

      await newUser.save();
      return { ...newUser.toObject(), id: newUser._id.toString() };
    }

    // Fallback JSON DB
    const usersList = Object.values(this.localData.users);
    if (usersList.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Username is already registered! Please choose a different username.');
    }

    const userId = `user_${Date.now()}`;
    const newUser = {
      id: userId,
      username,
      displayName: fullName || username,
      phone,
      password,
      balance: 100,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString()
    };
    this.localData.users[userId] = newUser;
    this.saveLocal();
    return newUser;
  }

  // AUTHENTICATE / LOGIN USER FROM MONGO DB
  async authenticateUser({ loginInput, password }) {
    if (isMongoConnected) {
      const user = await User.findOne({
        $or: [
          { username: new RegExp(`^${loginInput}$`, 'i') },
          { phone: loginInput }
        ]
      });

      if (!user) {
        throw new Error('User not found in database! Please check your username or phone number.');
      }

      if (user.status === 'BLOCKED') {
        throw new Error('Account suspended by Admin. Please contact support.');
      }

      if (user.password && password && user.password !== password) {
        throw new Error('Incorrect password! Please try again.');
      }

      return { ...user.toObject(), id: user._id.toString() };
    }

    // Local JSON DB authentication
    const usersList = Object.values(this.localData.users);
    const user = usersList.find(u =>
      (u.username.toLowerCase() === loginInput.toLowerCase() || u.phone === loginInput)
    );

    if (!user) {
      throw new Error('User not found in database! Please check your username or phone number.');
    }

    if (user.password && password && user.password !== password) {
      throw new Error('Incorrect password! Please try again.');
    }

    return user;
  }

  // UPDATE USER BALANCE IN MONGO DB
  async updateBalance(userId, delta) {
    if (isMongoConnected) {
      try {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const user = await User.findById(userId);
          if (user) {
            user.balance = Math.max(0, user.balance + delta);
            await user.save();
            return user.balance;
          }
        }
        const userByUsername = await User.findOne({ username: userId });
        if (userByUsername) {
          userByUsername.balance = Math.max(0, userByUsername.balance + delta);
          await userByUsername.save();
          return userByUsername.balance;
        }
      } catch (e) {}
    }

    const localUser = await this.getUser(userId);
    if (localUser) {
      localUser.balance = Math.max(0, (localUser.balance || 0) + delta);
      this.saveLocal();
      return localUser.balance;
    }
    return 0;
  }

  // TOGGLE BLOCK USER IN MONGO DB
  async toggleBlockUser(userId) {
    if (isMongoConnected) {
      try {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const user = await User.findById(userId);
          if (user) {
            user.status = user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
            await user.save();
            return { ...user.toObject(), id: user._id.toString() };
          }
        }
      } catch (e) {}
    }

    if (this.localData.users[userId]) {
      const u = this.localData.users[userId];
      u.status = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
      this.saveLocal();
      return u;
    }
    return null;
  }

  async addTransaction(tx) {
    if (isMongoConnected) {
      try {
        const newTx = new Transaction(tx);
        await newTx.save();
        return { ...newTx.toObject(), id: newTx._id.toString() };
      } catch (e) {}
    }
    return tx;
  }

  async getLeaderboard() {
    if (isMongoConnected) {
      try {
        const users = await User.find({}).sort({ totalEarned: -1 }).limit(20).lean();
        return users.map(u => ({ ...u, id: u._id.toString() }));
      } catch (e) {}
    }
    return Object.values(this.localData.users).sort((a, b) => (b.totalEarned || 0) - (a.totalEarned || 0)).slice(0, 20);
  }

  async getGameHistory() {
    if (isMongoConnected) {
      try {
        return await GameHistory.find({}).sort({ timestamp: -1 }).limit(15).lean();
      } catch (e) {}
    }
    return this.localData.gameHistory || [];
  }

  async getTransactions(userId) {
    if (isMongoConnected) {
      try {
        return await Transaction.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
      } catch (e) {}
    }
    return [];
  }
}

export const db = new DatabaseService();
