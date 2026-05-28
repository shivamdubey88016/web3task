import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send } from 'lucide-react';

const QUICK_EMOJIS = ['🍿', '😂', '🔥', '😮', '❤️', '👏', '🎉', '😢'];

export const ChatArea = ({
  chatMessages,
  myUserId,
  socket,
}) => {
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  // Auto scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    socket.emit('chat_message', { message: chatInput });
    setChatInput('');
  };

  const handleSendEmoji = (emoji) => {
    if (!socket) return;
    socket.emit('chat_message', { message: emoji });
  };

  return (
    <div className="glass-panel sidebar-panel chat-panel">
      <div className="panel-header">
        <div className="panel-title">
          <MessageSquare size={16} />
          <span>Live Chat</span>
        </div>
      </div>

      <div className="chat-messages-container">
        {chatMessages.map((msg, index) => {
          const isSelf = msg.userId === myUserId;
          const isSys = msg.userId === 'system';
          
          if (isSys) {
            return (
              <div key={index} className="chat-message-bubble system">
                <div className="chat-body">{msg.message}</div>
              </div>
            );
          }

          return (
            <div key={index} className={`chat-message-bubble ${isSelf ? 'self' : ''}`}>
              <div className="chat-meta">
                <span className="chat-user">{msg.username}</span>
                <span className={`chat-role-pill ${msg.role.toLowerCase()}`}>{msg.role}</span>
                <span className="chat-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="chat-body">{msg.message}</div>
            </div>
          );
        })}
        <div ref={chatBottomRef}></div>
      </div>

      {/* Quick emoji reactions trigger bar */}
      <div className="flex gap-2 justify-center py-2 px-3 border-t border-white/5 bg-black/10">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="hover:scale-125 transition-transform duration-150 cursor-pointer text-lg p-1 bg-white/5 hover:bg-white/10 rounded-md border border-white/5"
            onClick={() => handleSendEmoji(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <form className="chat-input-form" onSubmit={handleSendChat}>
        <input
          type="text"
          placeholder="Say something..."
          className="chat-input"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          maxLength={100}
        />
        <button type="submit" className="chat-send-btn" disabled={!chatInput.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
