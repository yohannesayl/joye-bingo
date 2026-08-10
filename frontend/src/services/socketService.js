import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      this.socket = io(window.location.origin, {
        reconnectionAttempts: 5,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('[SocketService] Connected to Karta server:', this.socket.id);
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

  joinRoom(roomId, user) {
    this.getSocket().emit('join_room', { roomId, user });
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
