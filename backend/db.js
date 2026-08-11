import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data.json');

// MongoDB Atlas URI with exact cluster connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://yohannesayalew99_db_user:3QBaURuEDMP2pK9q@cluster0.fqlu2pr.mongodb.net/Joye-bingo?retryWrites=true&w=majority&appName=Cluster0';

let isMongoConnected = false;

// 1. MONGOOSE USER SCHEMA & MODEL WITH FIELDS: username, password, phonenumber, amount
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  phonenumber: { type: String, required: true, unique: true, trim: true },
  amount: { type: Number, default: 100 }, // Amount player has to play the game!
  phone: { type: String, default: '' },
  fullName: { type: String, default: '' },
  displayName: { type: String, default: '' },
  totalWins: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  status: { type: String, default: 'ACTIVE' },
  joinedAt: { type: Date, default: Date.now }
}, { collection: 'users' });

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, required: true },
  method: { type: String, default: 'Telebirr' },
  amount: { type: Number, required: true },
  reference: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'transactions' });

const gameHistorySchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  stake: { type: Number, required: true },
  winnerName: { type: String, required: true },
  winnerId: { type: String, required: true },
  prize: { type: Number, required: true },
  calledCount: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
}, { collection: 'game_history' });

const roomStateSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  stake: { type: Number, default: 10 },
  status: { type: String, default: 'WAITING_FOR_PLAYERS' },
  matchStartTime: { type: Number, default: 0 },
  gameStartTime: { type: Number, default: 0 },
  ballSequence: { type: [Number], default: [] },
  calledBalls: { type: [Number], default: [] },
  currentBall: { type: Object, default: null },
  purchasedCards: { type: Array, default: [] },
  players: { type: Array, default: [] },
  pot: { type: Number, default: 0 },
  winner: { type: Object, default: null },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'room_states' });

export const User = mongoose.model('User', userSchema);
export const Transaction = mongoose.model('Transaction', transactionSchema);
export const GameHistory = mongoose.model('GameHistory', gameHistorySchema);
export const RoomState = mongoose.model('RoomState', roomStateSchema);

class DatabaseService {
  constructor() {
    this.connectMongo();
    this.localData = this.loadLocal();
  }

  async connectMongo() {
    try {
      console.log('🔄 Connecting to MongoDB Atlas database (Joye-bingo)...');
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      isMongoConnected = true;
      console.log('✅ Connected successfully to MongoDB Atlas (Joye-bingo database)!');
    } catch (err) {
      console.warn('⚠️ MongoDB connection notice (Using fallback database):', err.message);
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
        return users.map(u => ({
          ...u,
          id: u._id.toString(),
          phone: u.phonenumber || u.phone,
          balance: u.amount !== undefined ? u.amount : 100
        }));
      } catch (e) {}
    }

    return Object.values(this.localData.users).map(u => ({
      ...u,
      phonenumber: u.phonenumber || u.phone,
      amount: u.amount !== undefined ? u.amount : u.balance || 100
    }));
  }

  // GET SINGLE USER BY ID
  async getUser(userId) {
    if (!userId) return null;

    if (isMongoConnected) {
      try {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const user = await User.findById(userId).lean();
          if (user) {
            return {
              ...user,
              id: user._id.toString(),
              phone: user.phonenumber || user.phone,
              balance: user.amount !== undefined ? user.amount : 100
            };
          }
        }
        const userByUsername = await User.findOne({ username: userId }).lean();
        if (userByUsername) {
          return {
            ...userByUsername,
            id: userByUsername._id.toString(),
            phone: userByUsername.phonenumber || userByUsername.phone,
            balance: userByUsername.amount !== undefined ? userByUsername.amount : 100
          };
        }
      } catch (e) {}
    }

    if (this.localData.users[userId]) {
      const u = this.localData.users[userId];
      return {
        ...u,
        phonenumber: u.phonenumber || u.phone,
        amount: u.amount !== undefined ? u.amount : u.balance || 100,
        balance: u.amount !== undefined ? u.amount : u.balance || 100
      };
    }

    // Guest fallback with 1,000 ETB bonus
    const guestUser = {
      id: userId,
      username: `Player_${userId.slice(-4)}`,
      displayName: `Player #${userId.slice(-4)}`,
      phonenumber: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
      phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: '123',
      amount: 1000,
      balance: 1000,
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

  // REGISTER NEW USER TO MONGO DB (FIELDS: username, password, phonenumber, amount)
  async registerUser({ fullName, username, phone, password }) {
    const rawPhone = phone || `09${Math.floor(10000000 + Math.random() * 90000000)}`;

    if (isMongoConnected) {
      const existingUser = await User.findOne({
        $or: [
          { username: new RegExp(`^${username}$`, 'i') },
          { phonenumber: rawPhone }
        ]
      });

      if (existingUser) {
        if (existingUser.username.toLowerCase() === username.toLowerCase()) {
          throw new Error('Username is already registered in MongoDB! Please log in.');
        }
        throw new Error('Phone number is already registered in MongoDB! Please log in.');
      }

      const newUser = new User({
        username,
        password,
        phonenumber: rawPhone,
        phone: rawPhone,
        fullName: fullName || username,
        displayName: fullName || username,
        amount: 100, // Amount player has to play the game!
        totalWins: 0,
        totalEarned: 0,
        gamesPlayed: 0
      });

      await newUser.save();
      const obj = newUser.toObject();
      return {
        ...obj,
        id: obj._id.toString(),
        phone: obj.phonenumber,
        balance: obj.amount
      };
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
      phonenumber: rawPhone,
      phone: rawPhone,
      password,
      amount: 100,
      balance: 100,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString()
    };
    this.localData.users[userId] = newUser;
    this.saveLocal();
    return newUser;
  }

  // AUTHENTICATE USER FROM MONGO DB (username/phonenumber + password)
  async authenticateUser({ loginInput, password }) {
    if (isMongoConnected) {
      const user = await User.findOne({
        $or: [
          { username: new RegExp(`^${loginInput}$`, 'i') },
          { phonenumber: loginInput },
          { phone: loginInput }
        ]
      });

      if (!user) {
        throw new Error('User not found in MongoDB! Please check your username or phone number.');
      }

      if (user.status === 'BLOCKED') {
        throw new Error('Account suspended by Admin. Please contact support.');
      }

      if (user.password && password && user.password !== password) {
        throw new Error('Incorrect password! Please try again.');
      }

      const obj = user.toObject();
      return {
        ...obj,
        id: obj._id.toString(),
        phone: obj.phonenumber || obj.phone,
        balance: obj.amount !== undefined ? obj.amount : 100
      };
    }

    // Local JSON DB authentication
    const usersList = Object.values(this.localData.users);
    const user = usersList.find(u =>
      (u.username.toLowerCase() === loginInput.toLowerCase() || u.phonenumber === loginInput || u.phone === loginInput)
    );

    if (!user) {
      throw new Error('User not found in database! Please check your username or phone number.');
    }

    if (user.password && password && user.password !== password) {
      throw new Error('Incorrect password! Please try again.');
    }

    return {
      ...user,
      phone: user.phonenumber || user.phone,
      balance: user.amount !== undefined ? user.amount : user.balance || 100
    };
  }

  // UPDATE PLAYER AMOUNT IN MONGO DB
  async updateBalance(userId, delta) {
    if (isMongoConnected) {
      try {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const user = await User.findById(userId);
          if (user) {
            user.amount = Math.max(0, (user.amount !== undefined ? user.amount : 100) + delta);
            await user.save();
            return user.amount;
          }
        }
        const userByUsername = await User.findOne({ username: userId });
        if (userByUsername) {
          userByUsername.amount = Math.max(0, (userByUsername.amount !== undefined ? userByUsername.amount : 100) + delta);
          await userByUsername.save();
          return userByUsername.amount;
        }
      } catch (e) {}
    }

    const localUser = await this.getUser(userId);
    if (localUser) {
      localUser.amount = Math.max(0, (localUser.amount !== undefined ? localUser.amount : localUser.balance || 100) + delta);
      localUser.balance = localUser.amount;
      this.saveLocal();
      return localUser.amount;
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
            const obj = user.toObject();
            return { ...obj, id: obj._id.toString(), balance: obj.amount };
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
        return users.map(u => ({ ...u, id: u._id.toString(), balance: u.amount }));
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
