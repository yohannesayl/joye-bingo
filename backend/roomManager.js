import { generateBingoCard, validateBingoClaim, getLetterForNumber } from './gameEngine.js';
import { db } from './db.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.initDefaultRooms();
  }

  initDefaultRooms() {
    const defaultRooms = [
      { id: 'room_10', name: '10birr Match', stake: 10, minPlayers: 2, houseCommission: 0.15 },
      { id: 'room_20', name: '20birr Match', stake: 20, minPlayers: 2, houseCommission: 0.15 },
      { id: 'room_30', name: '30birr Match', stake: 30, minPlayers: 2, houseCommission: 0.15 },
      { id: 'room_50', name: '50birr Match', stake: 50, minPlayers: 2, houseCommission: 0.15 },
      { id: 'room_80', name: '80birr Match', stake: 80, minPlayers: 2, houseCommission: 0.15 },
      { id: 'room_100', name: '100birr Match', stake: 100, minPlayers: 2, houseCommission: 0.10 },
      { id: 'room_150', name: '150birr Match', stake: 150, minPlayers: 2, houseCommission: 0.10 },
      { id: 'room_200', name: '200birr Match', stake: 200, minPlayers: 2, houseCommission: 0.10 },
      { id: 'room_300', name: '300birr Match', stake: 300, minPlayers: 2, houseCommission: 0.10 },
    ];

    defaultRooms.forEach(config => {
      this.createRoom(config);
    });
  }

  createRoom(config) {
    const room = {
      id: config.id,
      name: config.name,
      stake: config.stake,
      minPlayers: 2,
      houseCommission: config.houseCommission,
      status: 'WAITING_FOR_PLAYERS', // STARTS AT WAITING WITH 0 PLAYERS!
      players: new Map(),
      cardPurchases: new Map(),
      calledBalls: [],
      remainingBalls: Array.from({ length: 75 }, (_, i) => i + 1),
      currentBall: null,
      countdownTimer: null,
      callInterval: null,
      callSpeedMs: 3000,
      autocall: true,
      countdownSeconds: 45,
      winner: null,
      pot: Math.round(config.stake * 2 * (1 - config.houseCommission)),
    };
    this.rooms.set(config.id, room);
    return room;
  }

  calculateRoomPot(room) {
    const totalCards = room.cardPurchases.size || room.players.size || 0;
    const effectiveCards = Math.max(2, totalCards);
    const grossPot = effectiveCards * room.stake;
    return Math.round(grossPot * (1 - room.houseCommission));
  }

  getRoomList() {
    return Array.from(this.rooms.values()).map(r => {
      const pot = this.calculateRoomPot(r);
      return {
        id: r.id,
        name: r.name,
        stake: r.stake,
        status: r.status,
        playerCount: r.players.size, // REALTIME JOINED PLAYER COUNT!
        totalCards: r.cardPurchases.size,
        pot,
        possibleWin: `${pot} Birr`,
        countdownSeconds: r.status === 'WAITING_FOR_PLAYERS' ? 45 : r.countdownSeconds,
        currentBall: r.currentBall,
        calledCount: r.calledBalls.length
      };
    });
  }

  getRoomDetails(roomId) {
    let room = this.rooms.get(roomId);
    if (!room) {
      const stakeNum = parseInt(roomId.replace('room_', '')) || 10;
      room = this.createRoom({ id: roomId, name: `${stakeNum}birr Match`, stake: stakeNum, houseCommission: 0.15 });
    }

    const pot = this.calculateRoomPot(room);
    room.pot = pot;

    return {
      id: room.id,
      name: room.name,
      stake: room.stake,
      status: room.status,
      playerCount: room.players.size,
      pot,
      possibleWin: `${pot} Birr`,
      calledBalls: room.calledBalls,
      currentBall: room.currentBall,
      autocall: room.autocall,
      callSpeedMs: room.callSpeedMs,
      countdownSeconds: room.status === 'WAITING_FOR_PLAYERS' ? 45 : room.countdownSeconds,
      winner: room.winner,
      purchasedCards: Array.from(room.cardPurchases.values()).map(cp => ({
        cardId: cp.card.id,
        userId: cp.userId,
        userName: cp.userName,
        card: cp.card
      }))
    };
  }

  joinRoom(socket, roomId, user) {
    let room = this.rooms.get(roomId);
    if (!room) {
      this.getRoomDetails(roomId);
      room = this.rooms.get(roomId);
    }

    // REQUIREMENT 1 & 2: LOCK JOINING WHILE MATCH IS IN PLAYING STATE!
    if (room.status === 'PLAYING') {
      return {
        success: false,
        error: 'Match currently in progress! Please wait for current game to finish before joining next round.',
        room: this.getRoomDetails(roomId)
      };
    }

    socket.join(roomId);
    if (user) {
      room.players.set(socket.id, {
        socketId: socket.id,
        userId: user.id,
        userName: user.displayName || user.username
      });
    }

    room.pot = this.calculateRoomPot(room);

    // REQUIREMENT 5: TIMER STARTS FRESHLY ONLY WHEN MORE THAN 1 PLAYER HAS JOINED (2+ PLAYERS)!
    if (room.players.size >= 2) {
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

  leaveRoom(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    socket.leave(roomId);
    room.players.delete(socket.id);

    room.pot = this.calculateRoomPot(room);

    if (room.status !== 'PLAYING' && room.players.size < 2) {
      room.status = 'WAITING_FOR_PLAYERS';
      room.countdownSeconds = 45;
      if (room.countdownTimer) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
      }
    }

    this.broadcastRoomUpdate(roomId);
  }

  buyCard(socket, roomId, userId, cardId) {
    let room = this.rooms.get(roomId);
    if (!room) {
      this.getRoomDetails(roomId);
      room = this.rooms.get(roomId);
    }

    if (room.status === 'PLAYING') {
      return { error: 'Match in progress. Cannot purchase cards mid-game!' };
    }

    const user = db.getUser(userId);
    if (user && room.stake > 0 && user.balance >= room.stake) {
      db.updateBalance(userId, -room.stake);
    }

    const card = generateBingoCard(cardId);
    room.cardPurchases.set(cardId, {
      cardId,
      userId: user ? user.id : userId,
      userName: user ? (user.displayName || user.username) : 'Player',
      card,
      isBot: false
    });

    room.pot = this.calculateRoomPot(room);
    this.broadcastRoomUpdate(roomId);

    return {
      success: true,
      card,
      balance: user ? db.getUser(userId).balance : 10000,
      pot: room.pot
    };
  }

  startCountdown(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.callInterval) {
      clearInterval(room.callInterval);
      room.callInterval = null;
    }
    if (room.countdownTimer) {
      clearInterval(room.countdownTimer);
      room.countdownTimer = null;
    }

    room.status = 'COUNTDOWN';
    room.countdownSeconds = 45;
    room.calledBalls = [];
    room.currentBall = null;
    room.winner = null;

    this.broadcastRoomUpdate(roomId);

    room.countdownTimer = setInterval(() => {
      if (room.players.size < 2) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        room.status = 'WAITING_FOR_PLAYERS';
        room.countdownSeconds = 45;
        this.broadcastRoomUpdate(roomId);
        return;
      }

      room.countdownSeconds--;
      this.io.to(roomId).emit('room_countdown', { roomId, seconds: room.countdownSeconds });

      if (room.countdownSeconds <= 0) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        this.startGame(roomId);
      }
    }, 1000);
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.players.size < 2) {
      room.status = 'WAITING_FOR_PLAYERS';
      room.countdownSeconds = 45;
      this.broadcastRoomUpdate(roomId);
      return;
    }

    room.status = 'PLAYING';
    room.calledBalls = [];
    room.remainingBalls = Array.from({ length: 75 }, (_, i) => i + 1);

    for (let i = room.remainingBalls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [room.remainingBalls[i], room.remainingBalls[j]] = [room.remainingBalls[j], room.remainingBalls[i]];
    }
    room.winner = null;

    this.broadcastRoomUpdate(roomId);
    this.io.to(roomId).emit('game_started', { roomId, pot: room.pot });

    if (room.callInterval) clearInterval(room.callInterval);

    room.callInterval = setInterval(() => {
      if (room.status === 'PLAYING' && room.remainingBalls.length > 0) {
        this.drawNextBall(roomId);
      } else {
        clearInterval(room.callInterval);
      }
    }, room.callSpeedMs);
  }

  drawNextBall(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'PLAYING' || room.remainingBalls.length === 0) return null;

    const ballNum = room.remainingBalls.shift();
    const ballLetter = getLetterForNumber(ballNum);
    const ballObj = { number: ballNum, letter: ballLetter, full: `${ballLetter}-${ballNum}` };

    room.calledBalls.push(ballNum);
    room.currentBall = ballObj;

    this.io.to(roomId).emit('ball_called', {
      roomId,
      ball: ballObj,
      calledBalls: room.calledBalls,
      remainingCount: room.remainingBalls.length
    });

    return ballObj;
  }

  claimBingo(socket, roomId, userId, cardId) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };

    const cardPurchase = room.cardPurchases.get(cardId);
    const userName = cardPurchase ? cardPurchase.userName : (socket.user ? socket.user.displayName : 'Player');

    this.confirmWinner(room, userId, userName, cardId, '5 in a Row');
    return { success: true, winner: room.winner };
  }

  confirmWinner(room, userId, userName, cardId, pattern) {
    if (room.status === 'FINISHED') return;

    room.status = 'FINISHED';
    if (room.callInterval) {
      clearInterval(room.callInterval);
      room.callInterval = null;
    }

    const prize = room.pot;

    if (userId && !userId.startsWith('bot_')) {
      const winnerUser = db.getUser(userId);
      if (winnerUser) {
        db.updateBalance(userId, prize);
      }
    }

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

    // REQUIREMENT 3 & 4: AFTER GAME COMPLETES, RESET PLAYER COUNT & CARD PURCHASES TO 0 AND WAIT FOR NEW JOINS!
    setTimeout(() => {
      this.resetAndNextMatch(room.id);
    }, 10000);
  }

  resetAndNextMatch(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.callInterval) clearInterval(room.callInterval);
    if (room.countdownTimer) clearInterval(room.countdownTimer);

    // RESET PLAYERS AND CARDS TO 0!
    room.players.clear();
    room.cardPurchases.clear();
    room.calledBalls = [];
    room.remainingBalls = Array.from({ length: 75 }, (_, i) => i + 1);
    room.currentBall = null;
    room.winner = null;

    // WAIT FOR NEW PLAYERS TO JOIN FRESHLY (START COUNT FROM 0 -> 1 -> 2+)
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
