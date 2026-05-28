import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { connectSocket, getSocket, disconnectSocket } from '../socket/socketService';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { ParticipantSidebar } from '../components/ParticipantSidebar';
import { ChatArea } from '../components/ChatArea';
import { Tv, Copy, LogOut, Search } from 'lucide-react';
import api from '../services/api';

// Extraction helper for YouTube video codes
function extractYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export const RoomPage = ({ roomId, initialRole, onLeave }) => {
  const { token, setErrorToast } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [currentVideoId, setCurrentVideoId] = useState('jfKfPfyJRdk');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) return;

    // Establish WebSocket Connection
    const s = connectSocket(token);
    setSocket(s);

    // Initial load for historical chat messages
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/rooms/${roomId}/history`);
        const formatted = res.data.map((m) => ({
          userId: m.userId,
          username: m.username,
          role: m.role,
          message: m.message,
          timestamp: new Date(m.timestamp).getTime()
        }));
        setChatMessages(formatted);
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };
    fetchHistory();

    s.on('connect', () => {
      console.log('Socket handshake completed. Emitting join...');
      s.emit('join_room', { roomId, username: '' });
    });

    s.on('sync_state', (state) => {
      setCurrentVideoId(state.videoId);
      setParticipants(state.participants);
      if (state.messages) {
        setChatMessages(state.messages);
      }
    });

    s.on('user_joined', ({ username, role, participants: list }) => {
      setParticipants(list);
    });

    s.on('user_left', ({ username, participants: list }) => {
      setParticipants(list);
    });

    s.on('role_assigned', ({ userId, role, participants: list }) => {
      setParticipants(list);
      if (userId === s.id) {
        setErrorToast(`Your role has been updated to ${role}!`);
      }
    });

    s.on('participant_removed', ({ userId, participants: list }) => {
      setParticipants(list);
    });

    s.on('kicked', () => {
      setErrorToast('You were removed from the room by the Host.');
      handleLeave();
    });

    s.on('chat_message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    s.on('error_message', (msg) => {
      setErrorToast(msg);
    });

    return () => {
      disconnectSocket();
    };
  }, [roomId, token]);

  const myUserId = socket?.id || '';
  const me = participants.find((p) => p.id === myUserId);
  const myRole = me?.role || initialRole || 'Participant';
  const isController = myRole === 'Host' || myRole === 'Moderator';

  const handleLeave = () => {
    disconnectSocket();
    onLeave();
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setErrorToast('Invite link copied to clipboard!');
  };

  const handleLoadVideo = (e) => {
    e.preventDefault();
    if (!isController) {
      setErrorToast('Only the Host or Moderators can change the video.');
      return;
    }

    const videoId = extractYouTubeId(videoUrlInput);
    if (!videoId) {
      setErrorToast('Invalid YouTube link. Please input a valid watch address.');
      return;
    }

    socket?.emit('change_video', { videoId });
    setVideoUrlInput('');
  };

  return (
    <>
      <header className="app-header">
        <div className="header-brand">
          <span className="logo-emoji">🍿</span>
          <span className="brand-text">SyncParty</span>
        </div>

        <div className="room-badge-container">
          <div className="room-badge">
            <Tv size={14} />
            <span>Room Code: {roomId}</span>
          </div>

          <button type="button" className="copy-btn" onClick={handleCopyLink} title="Copy invite link">
            <Copy size={14} />
            <span>Invite</span>
          </button>

          <button type="button" className="leave-btn" onClick={handleLeave} title="Leave room">
            <LogOut size={14} />
            <span>Leave</span>
          </button>
        </div>
      </header>

      <main className="room-content">
        <div className="main-video-area">
          {/* Synchronized video search input */}
          <div className="glass-panel video-search-panel">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder={
                  isController
                    ? 'Paste YouTube Video Link here...'
                    : 'Ask the Host or Moderator to change the video'
                }
                className="video-search-input"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                disabled={!isController}
              />
            </div>
            <button
              type="submit"
              className="load-video-btn"
              onClick={handleLoadVideo}
              disabled={!isController || !videoUrlInput.trim()}
            >
              <Tv size={16} />
              <span>Sync Video</span>
            </button>
          </div>

          {/* Core Player Frame */}
          <YouTubePlayer
            videoId={currentVideoId}
            isController={isController}
            myRole={myRole}
            socket={socket}
            showToast={setErrorToast}
          />
        </div>

        {/* Control and Communication Bar */}
        <div className="sidebar-area">
          <ParticipantSidebar
            participants={participants}
            myUserId={myUserId}
            myRole={myRole}
            socket={socket}
          />
          
          <ChatArea
            chatMessages={chatMessages}
            myUserId={myUserId}
            socket={socket}
          />
        </div>
      </main>
    </>
  );
};
