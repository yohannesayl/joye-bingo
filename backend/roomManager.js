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
      { id: 'room_300', name: '300birr Match', stake: 300 },
    ];

    for (const cfg of roomConfigs) {
      await this.getOrCreateActiveRoom(cfg.id, false);
    }
  }

  async getOrCreateActiveRoom(stakeId = 'room_10', forceReset = false) {
    const safeId = typeof stakeId === 'string' ? stakeId : (stakeId?.id || 'room_10');
    let room = this.rooms.get(safeId);
    const nowMs = Date.now();
    const globalNextStart = Math.ceil(nowMs / 60000) * 60000;

    if (!forceReset && room) {
      if (room.status === 'PLAYING' || room.status === 'FINISHED') {
        return room;
      }
      if (room.status === 'WAITING' && room.targetEndTime > nowMs) {
        return room;
      }
    }

    const stakeNum = parseInt(safeId.replace('room_', ''), 10) || 10;

    if (!room || forceReset || (room.status === 'WAITING' && room.targetEndTime <= nowMs)) {
      room = {
        id: safeId,
        baseId: safeId,
        name: `${stakeNum}birr Match`,
        stake: stakeNum,
        status: 'WAITING',
        targetEndTime: globalNextStart,
        endTime: globalNextStart,
        countdownSeconds: Math.max(0, Math.ceil((globalNextStart - nowMs) / 1000)),
        players: room ? room.players : new Map(),
        cardPurchases: new Map(),
        calledBalls: [],
        remainingBalls: Array.from({ length: 75 }, (_, i) => i + 1),
        currentBall: null,
        callInterval: null,
        callSpeedMs: 3000,
        pot: 0,
        winner: null,
        timer: null
      };
      this.rooms.set(safeId, room);
      this.startCountdown(safeId);

      // Non-blocking background persistence to MongoDB Atlas
      db.updateRoomState(safeId, {
        roomId: safeId,
        stakeId: safeId,
        name: room.name,
        stake: room.stake,
        status: 'WAITING',
        targetEndTime: globalNextStart,
        endTime: new Date(globalNextStart)
      }).catch(err => console.error('[DB Sync Error]:', err));
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
    const globalNextStart = Math.ceil(now / 60000) * 60000;
    return Array.from(this.rooms.values()).map(r => {
      if (!r.targetEndTime || r.targetEndTime <= now) {
        r.targetEndTime = globalNextStart;
      }
      const targetEndTime = r.targetEndTime;
      const remainingMs = Math.max(0, targetEndTime - now);
      const liveCountdownSeconds = Math.ceil(remainingMs / 1000);
      return {
        id: r.id,
        name: r.name,
        stake: r.stake,
        status: (r.status && r.status !== 'None') ? r.status : 'WAITING',
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
    const globalNextStart = Math.ceil(now / 60000) * 60000;
    if (!room.targetEndTime || room.targetEndTime <= now) {
      room.targetEndTime = globalNextStart;
    }
    const targetEndTime = room.targetEndTime;
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
    const globalNextStart = Math.ceil(now / 60000) * 60000;
    if (!room.targetEndTime || room.targetEndTime <= now) {
      room.targetEndTime = globalNextStart;
    }
    const targetEndTime = room.targetEndTime;
    const remainingMs = Math.max(0, targetEndTime - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    // CRITICAL: Send fixed targetEndTime AND serverTime timestamp to ALL players in this room!
    this.io.to(room.id).emit('lobby_state_update', {
      roomId: room.id,
      targetEndTime: targetEndTime,
      serverTime: now,
      playerCount: activeCount
    });

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

    if (socket && socket.join) {
      socket.join(room.id);
    }

    if (room.cardPurchases.has(cardId)) {
      const buyer = room.cardPurchases.get(cardId);
      if (buyer.userId !== userId) {
        return { error: 'Card already selected by another player!' };
      }
    }

    let user = await db.getUser(userId);
    if (!user || (user.balance !== undefined && user.balance < room.stake)) {
      return { error: `Insufficient wallet balance! You need at least ${room.stake} Birr to play in this room.` };
    }

    if (user) {
      await db.updateBalance(userId, -room.stake);
    }

    const card = generateBingoCard(cardId);
    const buyerName = user?.displayName || user?.username || `Player_${socket.id.slice(-4)}`;

    if (socket && socket.id) {
      room.players.set(socket.id, {
        socketId: socket.id,
        userId: userId || socket.id,
        userName: buyerName
      });
    }

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

    const now = Date.now();
    const globalNextStart = Math.ceil(now / 60000) * 60000;
    if (!room.targetEndTime || room.targetEndTime <= now) {
      room.targetEndTime = globalNextStart;
    }

    const updateRoundClock = () => {
      // If match is currently PLAYING or FINISHED, do NOT interrupt countdown
      if (room.status === 'PLAYING' || room.status === 'FINISHED') {
        return;
      }

      const now = Date.now();
      const remainingMs = Math.max(0, room.targetEndTime - now);
      room.countdownSeconds = Math.ceil(remainingMs / 1000);

      if (room.id === 'room_10' || room.countdownSeconds % 10 === 0 || room.countdownSeconds <= 10) {
        console.log(`[SERVER TICK] ${room.id} -> Game starts in: ${room.countdownSeconds}s (Target: ${room.targetEndTime})`);
      }

      const timerPayload = {
        roomId: room.id,
        targetEndTime: room.targetEndTime,
        serverTime: now,
        seconds: room.countdownSeconds,
        timeRemaining: room.countdownSeconds,
        playerCount: this.getPlayerCount(room)
      };

      this.io.to(room.id).emit('lobby_state', timerPayload);
      this.io.to(room.id).emit('timer_tick', timerPayload);
      this.io.to(room.id).emit('lobby_tick', timerPayload);
      this.io.to(room.id).emit('lobby_status', timerPayload);

      if (remainingMs <= 0 || room.countdownSeconds <= 0) {
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

    // IF 0 CARDS WERE BOUGHT IN THIS ROOM, DO NOT LOCK TO PLAYING!
    // ROLLOVER targetEndTime TO NEXT MINUTE CLEANLY!
    if (!room.cardPurchases || room.cardPurchases.size === 0) {
      const nowMs = Date.now();
      room.targetEndTime = Math.ceil((nowMs + 1000) / 60000) * 60000;
      room.status = 'WAITING';
      this.broadcastRoomUpdate(room.id);
      return;
    }

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
    const startPayload = {
      roomId: room.id,
      players: Array.from(room.players.values()),
      totalPlayers: this.getPlayerCount(room),
      room: details,
      message: 'Lobby locked! Game starting for all players simultaneously.'
    };

    this.io.to(room.id).emit('start_match', startPayload);
    this.io.emit('start_match', startPayload);
    this.io.to(room.id).emit('start_game', startPayload);
    this.io.emit('start_game', startPayload);
    this.io.to(room.id).emit('game_started', startPayload);
    this.io.emit('game_started', startPayload);
    this.io.to(room.id).emit('match_started', startPayload);
    this.io.emit('match_started', startPayload);

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
        // All 75 balls drawn: Reset room back to WAITING after 5 seconds!
        setTimeout(() => {
          this.resetAndNextMatch(roomId);
        }, 5000);
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

    // Broadcast "number_drawn" & "ball_called" to room & global fallback
    this.io.to(roomId).emit('number_drawn', ballPayload);
    this.io.emit('number_drawn', ballPayload);
    this.io.to(roomId).emit('ball_called', ballPayload);
    this.io.emit('ball_called', ballPayload);

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

    const winnerPayload = {
      roomId: room.id,
      winner: room.winner
    };

    // Broadcast bingo_winner & game_over STRICTLY to players in THIS room!
    this.io.to(room.id).emit('bingo_winner', winnerPayload);
    this.io.to(room.id).emit('game_over', winnerPayload);

    this.broadcastRoomUpdate(room.id);

    // Reset room state and start next game automatically after 4 seconds!
    setTimeout(() => {
      this.resetAndNextMatch(room.id);
    }, 4000);
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
    }
    this.io.emit('lobby_list', this.getRoomList());
  }
}
