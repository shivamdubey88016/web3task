import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import { socketAuthMiddleware } from './middleware/auth.js';
import registerSocketHandlers from './sockets/socketHandler.js';

// Init environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// API REST routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Serve react static builds in production
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date(), message: 'SyncParty API is healthy' });
});

// Single Page Application routing configuration
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Watch Party Server is Running! (Front-end build not found yet, run npm run build)');
    }
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Socket Auth JWT Middleware
io.use(socketAuthMiddleware);

// Bind WebSockets event handlers
registerSocketHandlers(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server boot successful. Listening on port ${PORT}`);
});
