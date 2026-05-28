import Room from '../models/Room.js';
import Participant from '../models/Participant.js';
import Message from '../models/Message.js';
import bcrypt from 'bcryptjs';

// Random room code generator (6 letters)
const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Create a Room Handler
export const createRoom = async (req, res) => {
  try {
    const { password } = req.body;
    let code = generateRoomCode();

    // Enforce uniqueness
    let roomExists = await Room.findOne({ code });
    while (roomExists) {
      code = generateRoomCode();
      roomExists = await Room.findOne({ code });
    }

    let isPasswordProtected = false;
    let hashedPassword = null;

    if (password && password.trim() !== '') {
      isPasswordProtected = true;
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password.trim(), salt);
    }

    const newRoom = new Room({
      code,
      hostId: req.user.id,
      isPasswordProtected,
      password: hashedPassword
    });

    await newRoom.save();

    // Automatically map host as active participant
    const participant = new Participant({
      roomId: newRoom._id,
      userId: req.user.id,
      role: 'Host',
      isActive: true
    });
    await participant.save();

    return res.status(201).json({
      code: newRoom.code,
      isPasswordProtected: newRoom.isPasswordProtected
    });
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ message: 'Internal Room creation failure.', error: error.message });
  }
};

// Check Room specifications before joining
export const getRoomInfo = async (req, res) => {
  try {
    const { code } = req.params;
    const room = await Room.findOne({ code: code.toUpperCase() }).populate('hostId', 'username');

    if (!room) {
      return res.status(404).json({ message: 'Watch Room not found.' });
    }

    return res.json({
      code: room.code,
      hostName: room.hostId?.username || 'Unknown',
      isPasswordProtected: room.isPasswordProtected
    });
  } catch (error) {
    console.error('Get room info error:', error);
    return res.status(500).json({ message: 'Internal Room checks failure.', error: error.message });
  }
};

// Join Room Handler with password gates
export const joinRoom = async (req, res) => {
  try {
    const { code } = req.params;
    const { password } = req.body;

    const room = await Room.findOne({ code: code.toUpperCase() });
    if (!room) {
      return res.status(404).json({ message: 'Watch Room not found.' });
    }

    // Verify password if locked
    if (room.isPasswordProtected) {
      if (!password) {
        return res.status(400).json({ message: 'Password is required to enter this room.' });
      }
      const isMatch = await bcrypt.compare(password, room.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid room password.' });
      }
    }

    // Assign appropriate role (host defaults, participants otherwise)
    let role = 'Participant';
    if (room.hostId.toString() === req.user.id) {
      role = 'Host';
    }

    let participant = await Participant.findOne({ roomId: room._id, userId: req.user.id });
    if (participant) {
      participant.role = role;
      participant.isActive = true;
      await participant.save();
    } else {
      participant = new Participant({
        roomId: room._id,
        userId: req.user.id,
        role,
        isActive: true
      });
      await participant.save();
    }

    return res.json({
      success: true,
      code: room.code,
      role: participant.role
    });
  } catch (error) {
    console.error('Join Room error:', error);
    return res.status(500).json({ message: 'Internal join validation failure.', error: error.message });
  }
};

// Retrieve history for room chat
export const getRoomHistory = async (req, res) => {
  try {
    const { code } = req.params;
    const room = await Room.findOne({ code: code.toUpperCase() });
    if (!room) {
      return res.status(404).json({ message: 'Watch Room not found.' });
    }

    // Retrieve last 100 chat messages chronologically
    const messages = await Message.find({ roomId: room._id })
      .sort({ timestamp: 1 })
      .limit(100);

    return res.json(messages);
  } catch (error) {
    console.error('Get room history error:', error);
    return res.status(500).json({ message: 'Internal history recovery failure.', error: error.message });
  }
};
