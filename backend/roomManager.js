import { generateBingoCard } from './gameEngine.js';
import { db } from './db.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.activeLobbies = new Map();
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

  async initDefaultRooms() {
    const roomConfigs = [
      { id: 'room_10', name: '10birr Match', stake: 10 },
      { id: 'room_20', name: '20birr Match', stake: 20 },
      { id: 'room_30', name: '30birr Match', stake: 30 },
      { id: 'room_50', name: '50birr Match', stake: 50 },
      { id: 'room_80', name: '80birr Match', stake: 80 },
      { id: 'room_100', name: '100birr Match', stake: 100 },
      { id: 'room_150', name: '150birr Match', stake: 150 },
      { id: 'room_200', name: '200birr Match', stake: 200 },
    ];

    for (const cfg of roomConfigs) {
      await this.getOrCreateActiveRoom(cfg.id, true);
    }
  }

  async getOrCreateActiveRoom(stakeId = 'room_10', forceReset = false) {
    const now = new Date();
    const stakeNum = parseInt(stakeId.replace('room_', ''), 10) || 10;
    const LOBBY_DURATION_MS = 60000; // 60 seconds room window

    // 1. Query MongoDB Atlas for active WAITING document whose endTime has NOT passed
    let roomDoc = await db.getRoomState(stakeId);
    if (forceReset || !roomDoc || roomDoc.status !== 'WAITING' || !roomDoc.endTime || new Date(roomDoc.endTime) <= now) {
      // Create/Reset persistent lobby document in MongoDB Atlas with startTime and endTime ISODates
      const roomId = stakeId;
      const startTime = now;
      const endTime = new Date(now.getTime() + LOBBY_DURATION_MS);

      const updated = await db.updateRoomState(roomId, {
        roomId,
        stakeId,
        name: `${stakeNum}birr Match`,
        stake: stakeNum,
        status: 'WAITING',
        startTime,
        endTime,
        countdownSeconds: 60,
        players: [],
        cardPurchases: [],
        calledBalls: [],
        currentBall: null,
        winner: null,
        pot: 0
      });
      if (updated) roomDoc = updated;
      console.log(`[MongoDB Atlas Clean Lobby] Reset ${roomId}: WAITING until ${endTime.toISOString()}`);
    }

    const safeEndTime = (roomDoc && roomDoc.endTime) ? roomDoc.endTime : new Date(now.getTime() + LOBBY_DURATION_MS);
    const endTimeMs = new Date(safeEndTime).getTime();
    const remainingMs = Math.max(0, endTimeMs - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    let room = this.rooms.get(stakeId);
    if (!room) {
      room = {
        id: stakeId,
        baseId: stakeId,
        name: `${stakeNum}birr Match`,
        stake: stakeNum,
        status: (roomDoc && roomDoc.status) || 'WAITING',
        endTime: endTimeMs,
        countdownSeconds: remainingSeconds,
        players: new Map(),
        cardPurchases: new Map(),
        calledBalls: roomDoc ? (roomDoc.calledBalls || []) : [],
        remainingBalls: Array.from({ length: 75 }, (_, i) => i + 1),
        currentBall: roomDoc ? (roomDoc.currentBall || null) : null,
        callInterval: null,
        callSpeedMs: 3000,
        pot: roomDoc ? (roomDoc.pot || 0) : 0,
        winner: roomDoc ? (roomDoc.winner || null) : null,
        timer: null
      };
      this.rooms.set(stakeId, room);
      this.startCountdown(stakeId);
    } else {
      room.endTime = endTimeMs;
      room.countdownSeconds = remainingSeconds;
      if (roomDoc && roomDoc.status) room.status = roomDoc.status;
    }

    return room;
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

  // COUNT UNIQUE JOINED PLAYERS STRICTLY BASED ON DISTINCT USERNAMES / USER IDS!
  getPlayerCount(room) {
    if (!room) return 0;
    const uniquePlayers = new Set();

    for (const [socketId, p] of room.players.entries()) {
      if (p.userName && p.userName.trim()) {
        uniquePlayers.add(p.userName.trim().toLowerCase());
      } else {
        uniquePlayers.add(socketId);
      }
    }

    for (const cp of room.cardPurchases.values()) {
      if (cp.userName && cp.userName.trim()) {
        uniquePlayers.add(cp.userName.trim().toLowerCase());
      }
    }

    return Math.max(uniquePlayers.size, room.players.size);
  }

  calculateRoomPot(room) {
    const config = this.roomPrices[room.id] || { stake: room.stake, commission: 15 };
    const playerCount = this.getPlayerCount(room);
    const grossPot = playerCount * config.stake;
    const houseCut = grossPot * (config.commission / 100);
    return Math.max(0, Math.round(grossPot - houseCut));
  }

  getRoomList() {
    const now = Date.now();
    return Array.from(this.rooms.values()).map(r => {
      const targetEndTime = r.endTime || (now + 60000);
      const remainingMs = Math.max(0, targetEndTime - now);
      const liveCountdownSeconds = Math.ceil(remainingMs / 1000);
      return {
        id: r.id,
        name: r.name,
        stake: r.stake,
        status: r.status,
        playerCount: this.getPlayerCount(r),
        cardsSold: r.cardPurchases.size,
        pot: this.calculateRoomPot(r),
        countdownSeconds: liveCountdownSeconds,
        targetEndTime: targetEndTime,
        serverTime: now
      };
    });
  }

  getRoomDetails(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const now = Date.now();
    const targetEndTime = room.endTime || (now + 60000);
    const remainingMs = Math.max(0, targetEndTime - now);
    const liveCountdownSeconds = Math.ceil(remainingMs / 1000);
    return {
      id: room.id,
      name: room.name,
      stake: room.stake,
      status: room.status,
      playerCount: this.getPlayerCount(room),
      countdownSeconds: liveCountdownSeconds,
      targetEndTime: targetEndTime,
      serverTime: now,
      calledBalls: room.calledBalls,
      currentBall: room.currentBall,
      pot: this.calculateRoomPot(room),
      winner: room.winner,
      purchasedCards: Array.from(room.cardPurchases.values()).map(cp => ({
        cardId: cp.cardId,
        userId: cp.userId,
        userName: cp.userName,
        card: cp.card
      }))
    };
  }

  async joinRoom(socket, roomId, user) {
    let room = await this.getOrCreateActiveRoom(roomId);
    if (!room) return { error: 'Room not found' };

    const effectiveUserId = user?.id || `user_${socket.id}`;
    const effectiveUserName = user?.displayName || user?.username || `Player_${socket.id.slice(-4)}`;

    socket.join(room.id);

    room.players.set(socket.id, {
      socketId: socket.id,
      userId: effectiveUserId,
      userName: effectiveUserName
    });

    const activeCount = this.getPlayerCount(room);
    room.pot = this.calculateRoomPot(room);

    const now = Date.now();
    const targetEndTime = room.endTime || (now + 60000);
    const remainingMs = Math.max(0, targetEndTime - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    // CRITICAL: Send fixed targetEndTime AND serverTime timestamp to ALL players in this room!
    this.io.to(room.id).emit('lobby_status', {
      roomId: room.id,
      playerCount: activeCount,
      timeRemaining: remainingSeconds,
      targetEndTime: targetEndTime,
      serverTime: now
    });

    this.io.to(room.id).emit('room_state', {
      roomId: room.id,
      targetEndTime: targetEndTime,
      serverTime: now,
      playerCount: activeCount,
      status: room.status
    });

    this.broadcastRoomUpdate(room.id);
    return { success: true, room: this.getRoomDetails(room.id) };
  }

  addBotToRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const botId = `bot_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const botName = `Bot_Tigist_${Math.floor(100 + Math.random() * 900)}`;

    room.players.set(botId, {
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

    if (room.status === 'WAITING_FOR_PLAYERS' || !room.countdownTimer) {
      this.startCountdown(roomId);
    }

    this.broadcastRoomUpdate(roomId);
    return { success: true, room: this.getRoomDetails(roomId) };
  }

  leaveRoom(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    socket.leave(roomId);

    for (const [key, player] of room.players.entries()) {
      if (player.socketId === socket.id) {
        room.players.delete(key);
        break;
      }
    }

    const activeCount = this.getPlayerCount(room);
    room.pot = this.calculateRoomPot(room);

    this.broadcastRoomUpdate(roomId);
  }

  async buyCard(socket, roomId, userId, cardId) {
    let room = await this.getOrCreateActiveRoom(roomId);
    if (!room) return { error: 'Room not found' };

    if (room.cardPurchases.has(cardId)) {
      const buyer = room.cardPurchases.get(cardId);
      if (buyer.userId !== userId) {
        return { error: 'Card already selected by another player!' };
      }
    }

    let user = await db.getUser(userId);
    if (!user || (user.balance !== undefined && user.balance < room.stake)) {
      await db.updateBalance(userId, 1000);
      user = await db.getUser(userId);
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

    if (room.status === 'WAITING_FOR_PLAYERS' || !room.countdownTimer) {
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

  getGlobalRoundTiming() {
    const LOBBY_DURATION_MS = 60000; // 60-second waiting period for all players to join!
    const nowMs = Date.now();
    const currentRoundIndex = Math.floor(nowMs / LOBBY_DURATION_MS);
    const nextRoundStartMs = (currentRoundIndex + 1) * LOBBY_DURATION_MS;
    const countdownSeconds = Math.max(0, Math.ceil((nextRoundStartMs - nowMs) / 1000));
    
    return {
      roundIndex: currentRoundIndex,
      nextRoundStartMs,
      countdownSeconds
    };
  }

  startCountdown(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.countdownTimer) {
      clearInterval(room.countdownTimer);
    }

    if (room.countdownSeconds === undefined || room.countdownSeconds <= 0) {
      room.countdownSeconds = 60;
    }

    const updateRoundClock = () => {
      // If match is currently PLAYING or FINISHED, do NOT interrupt countdown
      if (room.status === 'PLAYING' || room.status === 'FINISHED') {
        return;
      }

      // DIRECT DECREMENT: Decrement integer seconds every 1000ms!
      room.countdownSeconds--;

      // ZERO CLIENT TIMER PATTERN: Broadcast exact integer second to ALL connected players simultaneously!
      this.io.emit('timer_tick', {
        roomId: room.id,
        seconds: room.countdownSeconds,
        timeRemaining: room.countdownSeconds,
        playerCount: this.getPlayerCount(room)
      });

      this.io.emit('lobby_tick', {
        roomId: room.id,
        seconds: room.countdownSeconds,
        timeRemaining: room.countdownSeconds,
        playerCount: this.getPlayerCount(room)
      });

      this.io.to(room.id).emit('lobby_status', {
        roomId: room.id,
        seconds: room.countdownSeconds,
        playerCount: this.getPlayerCount(room),
        timeRemaining: room.countdownSeconds
      });

      if (room.countdownSeconds <= 0) {
        this.startGroupGame(room);
      } else {
        room.status = 'WAITING';
        this.broadcastRoomUpdate(roomId);
      }
    };

    room.countdownTimer = setInterval(updateRoundClock, 1000);
  }

  startGroupGame(room) {
    if (!room || room.status === 'PLAYING') return;

    if (room.timer) clearTimeout(room.timer);
    if (room.countdownTimer) clearInterval(room.countdownTimer);

    // Lock the room so new players join the NEXT lobby instead!
    room.status = 'PLAYING';
    room.calledBalls = [];
    room.remainingBalls = Array.from({ length: 75 }, (_, i) => i + 1);
    room.currentBall = null;
    room.winner = null;

    // Notify ALL players in this room at the SAME instant!
    const details = this.getRoomDetails(room.id);
    this.io.to(room.id).emit('game_started', {
      message: 'Lobby locked! Game starting for all players simultaneously.',
      totalPlayers: this.getPlayerCount(room),
      room: details
    });

    this.broadcastRoomUpdate(room.id);

    // Draw first ball immediately so all players see Ball #1 at 0:00!
    this.drawNextBall(room.id);
    this.startAutocall(room.id);
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

    // Persist to MongoDB Atlas Joye-bingo room_states table
    db.updateRoomState(roomId, {
      status: room.status,
      calledBalls: room.calledBalls,
      currentBall: room.currentBall,
      pot: room.pot
    });

    const ballPayload = {
      roomId,
      ball,
      number: ballNumber,
      calledBalls: room.calledBalls,
      history: room.calledBalls
    };

    // Broadcast "number_drawn" & "ball_called" to ALL connected players in that room simultaneously!
    this.io.to(roomId).emit('number_drawn', ballPayload);
    this.io.to(roomId).emit('ball_called', ballPayload);

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

    // Update MongoDB Atlas persistent state
    db.updateRoomState(room.id, {
      status: 'FINISHED',
      winner: room.winner,
      pot: room.pot
    });

    this.io.to(room.id).emit('bingo_winner', {
      roomId: room.id,
      winner: room.winner
    });

    this.broadcastRoomUpdate(room.id);

    setTimeout(() => {
      this.resetAndNextMatch(room.id);
    }, 5000);
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

    room.status = 'WAITING';
    room.countdownSeconds = 60;
    this.broadcastRoomUpdate(roomId);
    this.startCountdown(roomId);
  }

  broadcastRoomUpdate(roomId) {
    const details = this.getRoomDetails(roomId);
    if (details) {
      this.io.to(roomId).emit('room_state', details);
      this.io.emit('room_state', details);
    }
    this.io.emit('lobby_list', this.getRoomList());
  }
}
