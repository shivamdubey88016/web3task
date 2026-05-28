import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'syncpartysecrettokenkey';

// REST API Request Authorization Middleware
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. Authorization token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id, username, email
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Access denied. Invalid or expired token' });
  }
};

// Socket.IO Handshake JWT Validation Middleware
export const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  
  if (!token) {
    return next(new Error('Authentication failure: Handshake token is missing.'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // Attach user payload to the socket context
    next();
  } catch (err) {
    return next(new Error('Authentication failure: Token validation failed.'));
  }
};
