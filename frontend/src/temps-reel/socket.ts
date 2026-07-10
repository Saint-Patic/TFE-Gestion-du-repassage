import { io, type Socket } from 'socket.io-client';
import { lireJeton } from '../auth/stockage';

let socket: Socket | null = null;

// Ouvre la connexion Socket.IO authentifiée par le jeton courant.
export function connecterSocket(): Socket {
  if (socket) return socket;
  socket = io({ auth: { jeton: lireJeton() }, autoConnect: true });
  return socket;
}

export function deconnecterSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function obtenirSocket(): Socket | null {
  return socket;
}
