import { io } from 'socket.io-client';
import { getBackendUrl } from './config';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    const backendUrl = getBackendUrl();
    if (!this.socket) {
      this.socket = io(backendUrl, {
        reconnectionAttempts: 10,
        timeout: 10000,
        transports: ['polling', 'websocket']
      });

      this.socket.on('connect', () => {
        console.log('[SocketService] Connected to Joye Bingo server:', this.socket.id, 'at', backendUrl);
      });

      this.socket.on('disconnect', () => {
        console.log('[SocketService] Disconnected from server');
      });
    }
    return this.socket;
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  syncClock(callback) {
    const t1 = Date.now();
    this.getSocket().emit('sync_clock', t1, (data) => {
      const t4 = Date.now();
      const rtt = t4 - (data?.clientTime || t1);
      const serverTimeAtReceipt = (data?.serverTime || Date.now()) + (rtt / 2);
      const clockOffset = serverTimeAtReceipt - t4;
      if (typeof callback === 'function') {
        callback({ rtt, clockOffset, serverTime: serverTimeAtReceipt });
      }
    });
  }

  joinRoom(roomId, user) {
    this.getSocket().emit('join_room', { roomId, user });
    this.getSocket().emit('join_match', { roomId, user });
    this.getSocket().emit('join_queue', { roomId, user });
  }

  leaveRoom(roomId) {
    this.getSocket().emit('leave_room', { roomId });
  }

  buyCard(roomId, userId, cardId) {
    this.getSocket().emit('buy_card', { roomId, userId, cardId });
  }

  claimBingo(roomId, userId, cardId) {
    this.getSocket().emit('claim_bingo', { roomId, userId, cardId });
  }

  addBotPlayer(roomId) {
    this.getSocket().emit('add_bot_player', { roomId });
  }

  hostDrawBall(roomId) {
    this.getSocket().emit('host_draw_ball', { roomId });
  }

  hostSetSpeed(roomId, speedMs) {
    this.getSocket().emit('host_set_speed', { roomId, speedMs });
  }

  hostToggleAutocall(roomId, enabled) {
    this.getSocket().emit('host_toggle_autocall', { roomId, enabled });
  }
}

export const socketService = new SocketService();
