import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'syncpartysecrettokenkey';

// JWT generator
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Sign Up Handler
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please provide username, email, and password.' });
    }

    // Verify uniqueness
    const userExists = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() }
      ]
    });

    if (userExists) {
      return res.status(400).json({ message: 'Username or email has already been registered.' });
    }

    const newUser = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password
    });

    await newUser.save();

    const token = generateToken(newUser);

    return res.status(201).json({
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        avatarUrl: newUser.avatarUrl
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal registration failure.', error: error.message });
  }
};

// Sign In Handler
export const login = async (req, res) => {
  try {
    const { identity, password } = req.body; // 'identity' can be either username or email

    if (!identity || !password) {
      return res.status(400).json({ message: 'Please specify username/email and password.' });
    }

    const user = await User.findOne({
      $or: [
        { email: identity.trim().toLowerCase() },
        { username: identity.trim() }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid username, email, or password credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username, email, or password credentials.' });
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal login failure.', error: error.message });
  }
};

// Fetch current user details
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Authenticated user profile not found.' });
    }
    return res.json(user);
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({ message: 'Internal profile retrieval failure.', error: error.message });
  }
};
