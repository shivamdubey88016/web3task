import React, { useState } from 'react';
import { Users, Shield, ShieldCheck, Lock, Crown, Trash2 } from 'lucide-react';

export const ParticipantSidebar = ({
  participants,
  myUserId,
  myRole,
  socket,
}) => {
  const [activeUserDropdown, setActiveUserDropdown] = useState(null);

  const handleAssignRole = (userId, newRole) => {
    socket?.emit('assign_role', { userId, role: newRole });
    setActiveUserDropdown(null);
  };

  const handleKickUser = (userId) => {
    socket?.emit('remove_participant', { userId });
    setActiveUserDropdown(null);
  };

  return (
    <div className="glass-panel sidebar-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Users size={16} />
          <span>Watchers</span>
        </div>
        <span className="panel-count">{participants.length}</span>
      </div>

      <div className="participants-list-container">
        {participants.map((user) => (
          <div key={user.id} className="participant-item">
            <div className="participant-info">
              <div className="participant-avatar">
                {user.username.substring(0, 2)}
              </div>
              <div className="participant-name-wrapper">
                <span className="participant-name" title={user.username}>
                  {user.username} {user.id === myUserId && '(You)'}
                </span>
                <span className={`participant-role ${user.role.toLowerCase()}`}>
                  {user.role}
                </span>
              </div>
            </div>

            {/* Dropdown controls for Host */}
            {myRole === 'Host' && user.id !== myUserId && (
              <div className="action-menu-dropdown">
                <button
                  type="button"
                  className="action-popover-trigger"
                  onClick={() => setActiveUserDropdown(activeUserDropdown === user.id ? null : user.id)}
                >
                  <Shield size={14} />
                </button>

                {activeUserDropdown === user.id && (
                  <div className="action-menu-content">
                    {user.role !== 'Moderator' && (
                      <button
                        type="button"
                        className="action-menu-btn"
                        onClick={() => handleAssignRole(user.id, 'Moderator')}
                      >
                        <ShieldCheck size={14} />
                        <span>Make Moderator</span>
                      </button>
                    )}
                    {user.role !== 'Participant' && (
                      <button
                        type="button"
                        className="action-menu-btn"
                        onClick={() => handleAssignRole(user.id, 'Participant')}
                      >
                        <Lock size={14} />
                        <span>Demote to Watcher</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="action-menu-btn"
                      onClick={() => handleAssignRole(user.id, 'Host')}
                    >
                      <Crown size={14} />
                      <span>Transfer Host</span>
                    </button>
                    <button
                      type="button"
                      className="action-menu-btn kick"
                      onClick={() => handleKickUser(user.id)}
                    >
                      <Trash2 size={14} />
                      <span>Kick from Party</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
