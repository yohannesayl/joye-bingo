import { generateBingoCard } from './gameEngine.js';
import { db } from './db.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.roomPrices = {
      room_10: { stake: 10, commission: 15 },
      room_20: { stake: 20, commission: 15 },
      room_30: { stake: 30, commission: 15 },
      room_50: { stake: 50, commission: 15 },
      room_80: { stake: 80, commission: 15 },
      room_100: { stake: 100, commission: 10 },
      room_150: { stake: 150, commission: 10 },
      room_200: { stake: 200, commission: 10 },
      room_300: { stake: 300, commission: 10 },
    };
    this.initDefaultRooms();
  }

  initDefaultRooms() {
    const roomConfigs = [
      { id: 'room_10', name: '10birr Match', stake: 10 },
      { id: 'room_20', name: '20birr Match', stake: 20 },
      { id: 'room_30', name: '30birr Match', stake: 30 },
      { id: 'room_50', name: '50birr Match', stake: 50 },
      { id: 'room_80', name: '80birr Match', stake: 80 },
      { id: 'room_100', name: '100birr Match', stake: 100 },
      { id: 'room_150', name: '150birr Match', stake: 150 },
      { id: 'room_200', name: '200birr Match', stake: 200 },
      { id: 'room_300', name: '300birr Match', stake: 300 }
    ];

    roomConfigs.forEach(cfg => {
      this.rooms.set(cfg.id, {
        id: cfg.id,
        name: cfg.name,
        stake: cfg.stake,
        status: 'WAITING_FOR_PLAYERS', // 'WAITING_FOR_PLAYERS', 'COUNTDOWN', 'PLAYING', 'FINISHED'
        countdownSeconds: 45,
        countdownTimer: null,
        players: new Map(), // socketId -> { userId, userName }
        cardPurchases: new Map(), // cardId -> { userId, userName, card }
        calledBalls: [],
        remainingBalls: Array.from({ length: 75 }, (_, i) => i + 1),
        currentBall: null,
        callInterval: null,
        callSpeedMs: 3000,
        pot: 0,
        winner: null
      });
    });
  }

  updateRoomPrices(newPrices) {
    if (!newPrices) return;
    Object.keys(newPrices).forEach(roomId => {
      const room = this.rooms.get(roomId);
      if (room && newPrices[roomId]) {
        room.stake = newPrices[roomId].stake || room.stake;
        this.roomPrices[roomId] = {
          stake: newPrices[roomId].stake || room.stake,
          commission: newPrices[roomId].commission || 15
        };
        room.pot = this.calculateRoomPot(room);
      }
    });
    this.io.emit('lobby_list', this.getRoomList());
  }

  getPlayerCount(room) {
    if (!room) return 0;
    const playerSockets = room.players.size;
    const cardsBoughtCount = room.cardPurchases.size;
    return Math.max(playerSockets, cardsBoughtCount);
  }

  calculateRoomPot(room) {
    const config = this.roomPrices[room.id] || { stake: room.stake, commission: 15 };
    const playerCount = this.getPlayerCount(room);
    const grossPot = playerCount * config.stake;
    const houseCut = grossPot * (config.commission / 100);
    return Math.max(0, Math.round(grossPot - houseCut));
  }

  getRoomList() {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      name: r.name,
      stake: r.stake,
      status: r.status,
      playerCount: this.getPlayerCount(r),
      cardsSold: r.cardPurchases.size,
      pot: this.calculateRoomPot(r),
      countdownSeconds: r.countdownSeconds
    }));
  }

  getRoomDetails(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      id: room.id,
      name: room.name,
      stake: room.stake,
      status: room.status,
      playerCount: this.getPlayerCount(room),
      countdownSeconds: room.countdownSeconds,
      calledBalls: room.calledBalls,
      currentBall: room.currentBall,
      pot: this.calculateRoomPot(room),
      winner: room.winner,
      purchasedCards: Array.from(room.cardPurchases.values()).map(cp => ({
        cardId: cp.cardId,
        userId: cp.userId,
        userName: cp.userName
      }))
    };
  }

  joinRoom(socket, roomId, user) {
    let room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };

    if (room.status === 'PLAYING') {
      return {
        success: false,
        error: 'Match currently in progress! Please wait for current game to finish before joining next round.',
        room: this.getRoomDetails(roomId)
      };
    }

    socket.join(roomId);

    // Each distinct socket connection counts as a player!
    const effectiveUserId = user?.id || `user_${socket.id}`;
    const effectiveUserName = user?.displayName || user?.username || `Player_${socket.id.slice(-4)}`;

    room.players.set(socket.id, {
      socketId: socket.id,
      userId: effectiveUserId,
      userName: effectiveUserName
    });

    const activeCount = this.getPlayerCount(room);
    room.pot = this.calculateRoomPot(room);

    // START COUNTDOWN INSTANTLY WHEN 2+ PLAYERS HAVE JOINED!
    if (activeCount >= 2) {
      if (room.status === 'WAITING_FOR_PLAYERS' || !room.countdownTimer) {
        this.startCountdown(roomId);
      }
    } else {
      room.status = 'WAITING_FOR_PLAYERS';
      room.countdownSeconds = 45;
      if (room.countdownTimer) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
      }
    }

    this.broadcastRoomUpdate(roomId);
    return { success: true, room: this.getRoomDetails(roomId) };
  }

  addBotToRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const botId = `bot_${Date.now()}`;
    const botName = `Bot_Tigist`;

    room.players.set(`socket_${botId}`, {
      socketId: `socket_${botId}`,
      userId: botId,
      userName: botName
    });

    const randomCardId = Math.floor(Math.random() * 99) + 1;
    const card = generateBingoCard(randomCardId);
    room.cardPurchases.set(randomCardId, {
      cardId: randomCardId,
      userId: botId,
      userName: botName,
      card,
      isBot: true
    });

    room.pot = this.calculateRoomPot(room);

    const activeCount = this.getPlayerCount(room);
    if (activeCount >= 2) {
      if (room.status === 'WAITING_FOR_PLAYERS' || !room.countdownTimer) {
        this.startCountdown(roomId);
      }
    }

    this.broadcastRoomUpdate(roomId);
    return { success: true, room: this.getRoomDetails(roomId) };
  }

  leaveRoom(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    socket.leave(roomId);
    room.players.delete(socket.id);

    const activeCount = this.getPlayerCount(room);
    room.pot = this.calculateRoomPot(room);

    if (room.status !== 'PLAYING' && activeCount < 2) {
      room.status = 'WAITING_FOR_PLAYERS';
      room.countdownSeconds = 45;
      if (room.countdownTimer) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
      }
    }

    this.broadcastRoomUpdate(roomId);
  }

  async buyCard(socket, roomId, userId, cardId) {
    let room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };

    if (room.status === 'PLAYING') {
      return { error: 'Card buying locked during active match!' };
    }

    if (room.cardPurchases.has(cardId)) {
      const buyer = room.cardPurchases.get(cardId);
      if (buyer.userId !== userId) {
        return { error: 'Card already selected by another player!' };
      }
    }

    const user = await db.getUser(userId);
    if (user && user.balance < room.stake) {
      return { error: 'Insufficient wallet balance to buy card!' };
    }

    if (user) {
      await db.updateBalance(userId, -room.stake);
    }

    const card = generateBingoCard(cardId);
    const buyerName = user?.displayName || user?.username || `Player_${socket.id.slice(-4)}`;

    room.cardPurchases.set(cardId, {
      cardId,
      userId: userId || socket.id,
      userName: buyerName,
      card
    });

    const activeCount = this.getPlayerCount(room);
    room.pot = this.calculateRoomPot(room);

    if (activeCount >= 2 && (room.status === 'WAITING_FOR_PLAYERS' || !room.countdownTimer)) {
      this.startCountdown(roomId);
    }

    this.broadcastRoomUpdate(roomId);
    return {
      success: true,
      balance: user?.balance || 100,
      cardId,
      pot: room.pot
    };
  }

  startCountdown(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.countdownTimer) {
      clearInterval(room.countdownTimer);
    }

    room.status = 'COUNTDOWN';
    room.countdownSeconds = 45;
    this.broadcastRoomUpdate(roomId);

    room.countdownTimer = setInterval(() => {
      const activeCount = this.getPlayerCount(room);

      if (activeCount < 2) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        room.status = 'WAITING_FOR_PLAYERS';
        room.countdownSeconds = 45;
        this.broadcastRoomUpdate(roomId);
        return;
      }

      room.countdownSeconds -= 1;

      if (room.countdownSeconds <= 0) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        this.startMatch(roomId);
      } else {
        this.broadcastRoomUpdate(roomId);
      }
    }, 1000);
  }

  startMatch(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'PLAYING';
    room.calledBalls = [];
    room.remainingBalls = Array.from({ length: 75 }, (_, i) => i + 1);
    room.currentBall = null;
    room.winner = null;

    this.broadcastRoomUpdate(roomId);
    this.startAutocall(roomId);
  }

  startAutocall(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.callInterval) clearInterval(room.callInterval);

    room.callInterval = setInterval(() => {
      if (room.status !== 'PLAYING') {
        clearInterval(room.callInterval);
        return;
      }

      const ball = this.drawNextBall(roomId);
      if (!ball) {
        clearInterval(room.callInterval);
      }
    }, room.callSpeedMs || 3000);
  }

  drawNextBall(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.remainingBalls.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * room.remainingBalls.length);
    const ballNumber = room.remainingBalls.splice(randomIndex, 1)[0];

    let letter = 'B';
    if (ballNumber >= 16 && ballNumber <= 30) letter = 'I';
    else if (ballNumber >= 31 && ballNumber <= 45) letter = 'N';
    else if (ballNumber >= 46 && ballNumber <= 60) letter = 'G';
    else if (ballNumber >= 61 && ballNumber <= 75) letter = 'O';

    const ball = { letter, number: ballNumber };
    room.calledBalls.push(ballNumber);
    room.currentBall = ball;

    this.io.to(roomId).emit('ball_called', {
      roomId,
      ball,
      calledBalls: room.calledBalls
    });

    this.broadcastRoomUpdate(roomId);
    return ball;
  }

  async claimBingo(socket, roomId, userId, cardId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'PLAYING') return { error: 'No active match to claim Bingo!' };

    const purchase = room.cardPurchases.get(cardId);
    if (!purchase) {
      return { error: 'Card not found!' };
    }

    if (room.callInterval) clearInterval(room.callInterval);
    room.status = 'FINISHED';

    const prize = room.pot || this.calculateRoomPot(room);
    await db.updateBalance(userId, prize);

    let userName = purchase.userName;
    const userObj = await db.getUser(userId);
    if (userObj) {
      userObj.totalWins = (userObj.totalWins || 0) + 1;
      userObj.totalEarned = (userObj.totalEarned || 0) + prize;
      userObj.gamesPlayed = (userObj.gamesPlayed || 0) + 1;
      userName = userObj.displayName || userObj.username;
    }

    let pattern = '5 in a Row (Horizontal)';

    room.winner = {
      userId,
      userName,
      cardId,
      prize,
      pattern
    };

    this.io.to(room.id).emit('bingo_winner', {
      roomId: room.id,
      winner: room.winner
    });

    this.broadcastRoomUpdate(room.id);

    setTimeout(() => {
      this.resetAndNextMatch(room.id);
    }, 10000);
  }

  resetAndNextMatch(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.callInterval) clearInterval(room.callInterval);
    if (room.countdownTimer) clearInterval(room.countdownTimer);

    room.players.clear();
    room.cardPurchases.clear();
    room.calledBalls = [];
    room.remainingBalls = Array.from({ length: 75 }, (_, i) => i + 1);
    room.currentBall = null;
    room.winner = null;

    room.status = 'WAITING_FOR_PLAYERS';
    room.countdownSeconds = 45;
    this.broadcastRoomUpdate(roomId);
  }

  broadcastRoomUpdate(roomId) {
    const details = this.getRoomDetails(roomId);
    if (details) {
      this.io.to(roomId).emit('room_state', details);
    }
    this.io.emit('lobby_list', this.getRoomList());
  }
}
