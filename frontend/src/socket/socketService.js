import { io } from 'socket.io-client';

let socket = null;

export const connectSocket = (token) => {
  if (socket) {
    socket.disconnect();
  }

  // Uses standard host prefix which Vite proxies in dev and Node.js serves in production
  const socketUrl = window.location.origin;
  
  socket = io(socketUrl, {
    auth: {
      token
    },
    transports: ['websocket', 'polling']
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
