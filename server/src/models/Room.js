import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  videoId: {
    type: String,
    default: 'jfKfPfyJRdk'
  },
  playState: {
    type: String,
    enum: ['PLAYING', 'PAUSED'],
    default: 'PAUSED'
  },
  currentTime: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isPasswordProtected: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('Room', roomSchema);
