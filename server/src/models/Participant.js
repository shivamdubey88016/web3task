import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  socketId: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['Host', 'Moderator', 'Participant'],
    default: 'Participant'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate participation mappings
participantSchema.index({ roomId: 1, userId: 1 }, { unique: true });

export default mongoose.model('Participant', participantSchema);
