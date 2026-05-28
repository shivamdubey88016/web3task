import Room from '../models/Room.js';
import Participant from '../models/Participant.js';
import User from '../models/User.js';
import Message from '../models/Message.js';

// Helper to broadcast updated state of participants roster
async function getActiveParticipants(roomId) {
  const participants = await Participant.find({ roomId, isActive: true })
    .populate('userId', 'username avatarUrl');
  
  return participants.map(p => ({
    id: p.socketId,
    dbUserId: p.userId?._id,
    username: p.userId?.username || 'Guest',
    role: p.role
  }));
}

// Helper to fetch last 50 messages from DB
async function getRecentMessages(roomId) {
  const messages = await Message.find({ roomId })
    .sort({ timestamp: -1 })
    .limit(50);
  
  return messages.reverse().map(m => ({
    userId: m.userId,
    username: m.username,
    role: m.role,
    message: m.message,
    timestamp: m.timestamp.getTime()
  }));
}

export default function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Secured Socket connection initialized: ${socket.id} (User: ${socket.user.username})`);
    
    let currentRoomCode = null;
    let currentDbRoomId = null;

    // Helper: Validates user permissions before processing socket events
    const validateControllerAccess = async () => {
      if (!currentDbRoomId) return { allowed: false, reason: 'Room context missing' };
      
      const participant = await Participant.findOne({
        roomId: currentDbRoomId,
        userId: socket.user.id,
        isActive: true
      });

      if (!participant || (participant.role !== 'Host' && participant.role !== 'Moderator')) {
        return { allowed: false, reason: 'Access denied. Host or Moderator role required.' };
      }

      return { allowed: true, role: participant.role, participant };
    };

    // Helper: Broadcaster to update all users on room details
    const emitRoomStateChanged = async (room) => {
      const activeList = await getActiveParticipants(room._id);
      io.to(room.code).emit('room_state_changed', {
        roomId: room.code,
        videoId: room.videoId,
        playState: room.playState,
        currentTime: room.currentTime,
        lastUpdated: room.lastUpdated.getTime(),
        participants: activeList
      });
    };

    // 1. EVENT: join_room
    socket.on('join_room', async ({ roomId: roomCode }) => {
      try {
        if (!roomCode) {
          socket.emit('error_message', 'Room code is required.');
          return;
        }

        const cleanCode = roomCode.trim().toUpperCase();
        const room = await Room.findOne({ code: cleanCode });
        
        if (!room) {
          socket.emit('error_message', 'The requested Room does not exist.');
          return;
        }

        currentRoomCode = cleanCode;
        currentDbRoomId = room._id;
        socket.join(cleanCode);

        // Fetch or create participant representation
        let role = 'Participant';
        if (room.hostId.toString() === socket.user.id) {
          role = 'Host';
        }

        let participant = await Participant.findOne({ roomId: room._id, userId: socket.user.id });
        if (participant) {
          participant.socketId = socket.id;
          participant.role = role; // Safeguard if Host details changed
          participant.isActive = true;
          await participant.save();
        } else {
          participant = new Participant({
            roomId: room._id,
            userId: socket.user.id,
            socketId: socket.id,
            role,
            isActive: true
          });
          await participant.save();
        }

        console.log(`User ${socket.user.username} successfully mapped to room ${cleanCode} as ${participant.role}`);

        // System broadcast message
        const welcomeMessageText = `${socket.user.username} joined the party as ${participant.role}!`;
        const welcomeMsg = new Message({
          roomId: room._id,
          userId: 'system',
          username: 'System',
          role: 'System',
          message: welcomeMessageText
        });
        await welcomeMsg.save();

        const activeList = await getActiveParticipants(room._id);
        const recentMsgs = await getRecentMessages(room._id);

        // Notify other participants
        socket.to(cleanCode).emit('user_joined', {
          username: socket.user.username,
          userId: socket.id,
          role: participant.role,
          participants: activeList
        });

        // Broadcast a chat bubble for system message
        io.to(cleanCode).emit('chat_message', {
          userId: 'system',
          username: 'System',
          role: 'System',
          message: welcomeMessageText,
          timestamp: welcomeMsg.timestamp.getTime()
        });

        // Send current sync state to the joining user
        socket.emit('sync_state', {
          videoId: room.videoId,
          playState: room.playState,
          currentTime: room.currentTime,
          lastUpdated: room.lastUpdated.getTime(),
          participants: activeList,
          messages: recentMsgs
        });
      } catch (err) {
        console.error('Socket join_room error:', err);
        socket.emit('error_message', 'Database synchronization error occurred.');
      }
    });

    // 2. EVENT: play
    socket.on('play', async ({ currentTime }) => {
      try {
        const check = await validateControllerAccess();
        const room = await Room.findById(currentDbRoomId);
        
        if (!check.allowed || !room) {
          socket.emit('error_message', check.reason || 'Room error.');
          // Sync client back
          socket.emit('sync_state', {
            videoId: room?.videoId || 'jfKfPfyJRdk',
            playState: room?.playState || 'PAUSED',
            currentTime: room?.currentTime || 0,
            lastUpdated: room?.lastUpdated.getTime() || Date.now(),
            participants: await getActiveParticipants(currentDbRoomId)
          });
          return;
        }

        room.playState = 'PLAYING';
        room.currentTime = currentTime;
        room.lastUpdated = new Date();
        await room.save();

        // Broadcast to everyone else
        socket.to(currentRoomCode).emit('play', { currentTime, userId: socket.id });
        console.log(`Room ${currentRoomCode}: Play command broadcasted at ${currentTime}s by ${socket.user.username}`);
      } catch (err) {
        console.error('Socket play error:', err);
      }
    });

    // 3. EVENT: pause
    socket.on('pause', async ({ currentTime }) => {
      try {
        const check = await validateControllerAccess();
        const room = await Room.findById(currentDbRoomId);

        if (!check.allowed || !room) {
          socket.emit('error_message', check.reason || 'Room error.');
          socket.emit('sync_state', {
            videoId: room?.videoId || 'jfKfPfyJRdk',
            playState: room?.playState || 'PAUSED',
            currentTime: room?.currentTime || 0,
            lastUpdated: room?.lastUpdated.getTime() || Date.now(),
            participants: await getActiveParticipants(currentDbRoomId)
          });
          return;
        }

        room.playState = 'PAUSED';
        room.currentTime = currentTime;
        room.lastUpdated = new Date();
        await room.save();

        socket.to(currentRoomCode).emit('pause', { currentTime, userId: socket.id });
        console.log(`Room ${currentRoomCode}: Pause command broadcasted at ${currentTime}s by ${socket.user.username}`);
      } catch (err) {
        console.error('Socket pause error:', err);
      }
    });

    // 4. EVENT: seek (Debounced client-side)
    socket.on('seek', async ({ currentTime }) => {
      try {
        const check = await validateControllerAccess();
        const room = await Room.findById(currentDbRoomId);

        if (!check.allowed || !room) {
          socket.emit('error_message', check.reason || 'Room error.');
          socket.emit('sync_state', {
            videoId: room?.videoId || 'jfKfPfyJRdk',
            playState: room?.playState || 'PAUSED',
            currentTime: room?.currentTime || 0,
            lastUpdated: room?.lastUpdated.getTime() || Date.now(),
            participants: await getActiveParticipants(currentDbRoomId)
          });
          return;
        }

        room.currentTime = currentTime;
        room.lastUpdated = new Date();
        await room.save();

        socket.to(currentRoomCode).emit('seek', { currentTime, userId: socket.id });
        console.log(`Room ${currentRoomCode}: Seek command broadcasted to ${currentTime}s by ${socket.user.username}`);
      } catch (err) {
        console.error('Socket seek error:', err);
      }
    });

    // 5. EVENT: change_video
    socket.on('change_video', async ({ videoId }) => {
      try {
        if (!videoId) return;
        const check = await validateControllerAccess();
        const room = await Room.findById(currentDbRoomId);

        if (!check.allowed || !room) {
          socket.emit('error_message', check.reason || 'Room error.');
          socket.emit('sync_state', {
            videoId: room?.videoId || 'jfKfPfyJRdk',
            playState: room?.playState || 'PAUSED',
            currentTime: room?.currentTime || 0,
            lastUpdated: room?.lastUpdated.getTime() || Date.now(),
            participants: await getActiveParticipants(currentDbRoomId)
          });
          return;
        }

        room.videoId = videoId;
        room.playState = 'PAUSED';
        room.currentTime = 0;
        room.lastUpdated = new Date();
        await room.save();

        const announceMsgText = `${socket.user.username} synced a new video.`;
        const announceMsg = new Message({
          roomId: room._id,
          userId: 'system',
          username: 'System',
          role: 'System',
          message: announceMsgText
        });
        await announceMsg.save();

        // Broadcast video changes
        io.to(currentRoomCode).emit('change_video', { videoId, userId: socket.id });
        
        io.to(currentRoomCode).emit('chat_message', {
          userId: 'system',
          username: 'System',
          role: 'System',
          message: announceMsgText,
          timestamp: announceMsg.timestamp.getTime()
        });

        await emitRoomStateChanged(room);
        console.log(`Room ${currentRoomCode}: Video changed to ${videoId} by ${socket.user.username}`);
      } catch (err) {
        console.error('Socket change_video error:', err);
      }
    });

    // 6. EVENT: assign_role
    socket.on('assign_role', async ({ userId: targetSocketId, role: newRole }) => {
      try {
        if (!currentDbRoomId || !targetSocketId || !newRole) return;
        
        // Caller MUST be Host
        const callerParticipant = await Participant.findOne({
          roomId: currentDbRoomId,
          userId: socket.user.id,
          isActive: true
        });

        if (!callerParticipant || callerParticipant.role !== 'Host') {
          socket.emit('error_message', 'Permission denied. Only the Host can change user roles.');
          return;
        }

        // Find target socket and map user
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (!targetSocket) {
          socket.emit('error_message', 'User connection could not be identified.');
          return;
        }

        const targetParticipant = await Participant.findOne({
          roomId: currentDbRoomId,
          userId: targetSocket.user.id,
          isActive: true
        }).populate('userId', 'username');

        if (!targetParticipant) {
          socket.emit('error_message', 'Participant data not found in DB.');
          return;
        }

        const previousRole = targetParticipant.role;

        if (newRole === 'Host') {
          // HOST TRANSFER
          const room = await Room.findById(currentDbRoomId);
          if (!room) return;

          room.hostId = targetParticipant.userId._id;
          await room.save();

          targetParticipant.role = 'Host';
          callerParticipant.role = 'Moderator'; // Demote current host to Moderator

          await targetParticipant.save();
          await callerParticipant.save();

          const transferMsgText = `${socket.user.username} transferred Host role to ${targetParticipant.userId.username}.`;
          const systemMsg = new Message({
            roomId: room._id,
            userId: 'system',
            username: 'System',
            role: 'System',
            message: transferMsgText
          });
          await systemMsg.save();

          const activeList = await getActiveParticipants(room._id);
          
          io.to(currentRoomCode).emit('role_assigned', {
            userId: targetSocketId,
            username: targetParticipant.userId.username,
            role: 'Host',
            participants: activeList
          });

          io.to(currentRoomCode).emit('role_assigned', {
            userId: socket.id,
            username: socket.user.username,
            role: 'Moderator',
            participants: activeList
          });

          io.to(currentRoomCode).emit('chat_message', {
            userId: 'system',
            username: 'System',
            role: 'System',
            message: transferMsgText,
            timestamp: systemMsg.timestamp.getTime()
          });

          await emitRoomStateChanged(room);
          console.log(`Room ${currentRoomCode}: Host transferred from ${socket.user.username} to ${targetParticipant.userId.username}`);
        } else {
          // PROMOTION / DEMOTION
          targetParticipant.role = newRole;
          await targetParticipant.save();

          const promotionText = `${targetParticipant.userId.username}'s role was updated from ${previousRole} to ${newRole}.`;
          const systemMsg = new Message({
            roomId: currentDbRoomId,
            userId: 'system',
            username: 'System',
            role: 'System',
            message: promotionText
          });
          await systemMsg.save();

          const activeList = await getActiveParticipants(currentDbRoomId);

          io.to(currentRoomCode).emit('role_assigned', {
            userId: targetSocketId,
            username: targetParticipant.userId.username,
            role: newRole,
            participants: activeList
          });

          io.to(currentRoomCode).emit('chat_message', {
            userId: 'system',
            username: 'System',
            role: 'System',
            message: promotionText,
            timestamp: systemMsg.timestamp.getTime()
          });

          const room = await Room.findById(currentDbRoomId);
          if (room) await emitRoomStateChanged(room);
          console.log(`Room ${currentRoomCode}: User ${targetParticipant.userId.username} role changed to ${newRole}`);
        }
      } catch (err) {
        console.error('Socket assign_role error:', err);
      }
    });

    // 7. EVENT: remove_participant
    socket.on('remove_participant', async ({ userId: targetSocketId }) => {
      try {
        if (!currentDbRoomId || !targetSocketId) return;

        // Caller MUST be Host
        const callerParticipant = await Participant.findOne({
          roomId: currentDbRoomId,
          userId: socket.user.id,
          isActive: true
        });

        if (!callerParticipant || callerParticipant.role !== 'Host') {
          socket.emit('error_message', 'Permission denied. Only the Host can remove participants.');
          return;
        }

        if (targetSocketId === socket.id) {
          socket.emit('error_message', 'You cannot remove yourself. Please use the Leave option.');
          return;
        }

        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (!targetSocket) {
          socket.emit('error_message', 'User connection not found.');
          return;
        }

        const targetParticipant = await Participant.findOne({
          roomId: currentDbRoomId,
          userId: targetSocket.user.id,
          isActive: true
        });

        if (targetParticipant) {
          targetParticipant.isActive = false;
          targetParticipant.socketId = '';
          await targetParticipant.save();
        }

        const kickText = `${targetSocket.user.username} was removed from the party by the Host.`;
        const systemMsg = new Message({
          roomId: currentDbRoomId,
          userId: 'system',
          username: 'System',
          role: 'System',
          message: kickText
        });
        await systemMsg.save();

        // Send Kicked event to target client
        io.to(targetSocketId).emit('kicked');
        targetSocket.leave(currentRoomCode);

        const activeList = await getActiveParticipants(currentDbRoomId);

        // Notify remaining participants
        io.to(currentRoomCode).emit('participant_removed', {
          userId: targetSocketId,
          participants: activeList
        });

        io.to(currentRoomCode).emit('chat_message', {
          userId: 'system',
          username: 'System',
          role: 'System',
          message: kickText,
          timestamp: systemMsg.timestamp.getTime()
        });

        const room = await Room.findById(currentDbRoomId);
        if (room) await emitRoomStateChanged(room);
        console.log(`Room ${currentRoomCode}: User ${targetSocket.user.username} kicked by ${socket.user.username}`);
      } catch (err) {
        console.error('Socket remove_participant error:', err);
      }
    });

    // 8. EVENT: chat_message
    socket.on('chat_message', async ({ message }) => {
      try {
        if (!currentDbRoomId || !message || !message.trim()) return;

        const participant = await Participant.findOne({
          roomId: currentDbRoomId,
          userId: socket.user.id,
          isActive: true
        });

        if (!participant) return;

        const newMsg = new Message({
          roomId: currentDbRoomId,
          userId: socket.id,
          username: socket.user.username,
          role: participant.role,
          message: message.trim()
        });
        await newMsg.save();

        io.to(currentRoomCode).emit('chat_message', {
          userId: socket.id,
          username: socket.user.username,
          role: participant.role,
          message: newMsg.message,
          timestamp: newMsg.timestamp.getTime()
        });
      } catch (err) {
        console.error('Socket chat_message error:', err);
      }
    });

    // 9. EVENT: request_sync (Manual seek calibration trigger)
    socket.on('request_sync', async () => {
      try {
        if (!currentDbRoomId) return;
        const room = await Room.findById(currentDbRoomId);
        if (!room) return;

        const activeList = await getActiveParticipants(room._id);
        
        socket.emit('sync_state', {
          videoId: room.videoId,
          playState: room.playState,
          currentTime: room.currentTime,
          lastUpdated: room.lastUpdated.getTime(),
          participants: activeList
        });
      } catch (err) {
        console.error('Socket request_sync error:', err);
      }
    });

    // 10. DISCONNECT / LEAVE HANDLER
    const handleLeave = async () => {
      try {
        if (!currentDbRoomId) return;

        const participant = await Participant.findOne({
          roomId: currentDbRoomId,
          userId: socket.user.id,
          isActive: true
        });

        if (participant) {
          participant.isActive = false;
          participant.socketId = '';
          await participant.save();

          console.log(`User ${socket.user.username} disconnected from room ${currentRoomCode}`);

          // Check if there are other active users in the room
          const remainingActive = await Participant.find({ roomId: currentDbRoomId, isActive: true });
          
          if (remainingActive.length === 0) {
            console.log(`Room ${currentRoomCode} is empty. Leaving it inactive.`);
            return;
          }

          let hostTransferredName = '';
          
          // Re-assign Host if the disconnecting user was the Host
          if (participant.role === 'Host') {
            const room = await Room.findById(currentDbRoomId);
            if (room) {
              // Try to promote a Moderator first, otherwise first active user
              let newHostParticipant = remainingActive.find(p => p.role === 'Moderator');
              if (!newHostParticipant) {
                newHostParticipant = remainingActive[0];
              }

              newHostParticipant.role = 'Host';
              await newHostParticipant.save();

              room.hostId = newHostParticipant.userId;
              await room.save();

              const hostUserObj = await User.findById(newHostParticipant.userId);
              hostTransferredName = hostUserObj?.username || 'Guest';
            }
          }

          // System notification log
          let leaveMessageText = `${socket.user.username} left the watch party.`;
          if (hostTransferredName) {
            leaveMessageText += ` Host privileges transferred to ${hostTransferredName}.`;
          }

          const systemMsg = new Message({
            roomId: currentDbRoomId,
            userId: 'system',
            username: 'System',
            role: 'System',
            message: leaveMessageText
          });
          await systemMsg.save();

          const activeList = await getActiveParticipants(currentDbRoomId);

          io.to(currentRoomCode).emit('user_left', {
            username: socket.user.username,
            userId: socket.id,
            participants: activeList
          });

          io.to(currentRoomCode).emit('chat_message', {
            userId: 'system',
            username: 'System',
            role: 'System',
            message: leaveMessageText,
            timestamp: systemMsg.timestamp.getTime()
          });

          const room = await Room.findById(currentDbRoomId);
          if (room) await emitRoomStateChanged(room);
        }
      } catch (err) {
        console.error('Socket leave/disconnect execution error:', err);
      }
    };

    socket.on('leave_room', async () => {
      await handleLeave();
      if (currentRoomCode) {
        socket.leave(currentRoomCode);
        currentRoomCode = null;
        currentDbRoomId = null;
      }
    });

    socket.on('disconnect', async () => {
      await handleLeave();
    });
  });
}
