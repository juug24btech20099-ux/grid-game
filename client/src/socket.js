import { io } from 'socket.io-client';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

const socket = io(BACKEND, {
  autoConnect: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 20000
});

export default socket;
