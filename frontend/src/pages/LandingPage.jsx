import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, UserPlus, LogOut, Lock, Unlock } from 'lucide-react';
import api from '../services/api';

export const LandingPage = ({ onJoinSuccess }) => {
  const { user, logout, setErrorToast } = useAuth();
  const [tab, setTab] = useState('create');
  
  // Room Creation Configuration
  const [usePassword, setUsePassword] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  
  // Room Joining Validation
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/rooms', {
        password: usePassword ? createPassword : null
      });
      onJoinSuccess(res.data.code, 'Host');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create room. Please try again.';
      setErrorToast(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleInspectRoom = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setErrorToast('Please enter a Room Code');
      return;
    }
    
    setLoading(true);
    const code = joinCode.trim().toUpperCase();
    try {
      const res = await api.get(`/rooms/${code}`);
      if (res.data.isPasswordProtected) {
        setPasswordRequired(true);
        setErrorToast('This room is secured with a password.');
        setLoading(false);
      } else {
        // Room has no password gate. Directly proceed to join.
        await executeJoin(code, null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Room code not found.';
      setErrorToast(msg);
      setLoading(false);
    }
  };

  const handleJoinWithPassword = async (e) => {
    e.preventDefault();
    if (!joinPassword) {
      setErrorToast('Password is required');
      return;
    }
    setLoading(true);
    await executeJoin(joinCode.trim().toUpperCase(), joinPassword);
  };

  const executeJoin = async (code, password) => {
    try {
      const res = await api.post(`/rooms/${code}/join`, { password });
      onJoinSuccess(code, res.data.role);
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed. Incorrect password?';
      setErrorToast(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lobby-wrapper">
      {/* Logout Float Trigger */}
      <button 
        type="button" 
        className="leave-btn"
        style={{ position: 'absolute', top: '24px', right: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
        onClick={logout}
      >
        <LogOut size={16} />
        <span>Sign Out</span>
      </button>

      <div className="glass-panel lobby-card">
        <span className="lobby-logo">🍿</span>
        <h1 className="lobby-title">SyncParty</h1>
        <p className="lobby-subtitle">Welcome, <span style={{ color: 'var(--primary-hover)', fontWeight: 'bold' }}>{user?.username}</span>!</p>

        {!passwordRequired ? (
          <>
            <div className="lobby-tabs">
              <button 
                type="button" 
                className={`lobby-tab ${tab === 'create' ? 'active' : ''}`}
                onClick={() => setTab('create')}
              >
                Create Room
              </button>
              <button 
                type="button" 
                className={`lobby-tab ${tab === 'join' ? 'active' : ''}`}
                onClick={() => setTab('join')}
              >
                Join Room
              </button>
            </div>

            {tab === 'create' ? (
              <form onSubmit={handleCreateRoom}>
                <div style={{
                  marginBottom: '24px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label 
                      className="form-label" 
                      htmlFor="password-toggle"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, textTransform: 'none' }}
                    >
                      {usePassword ? <Lock size={16} style={{ color: 'var(--primary-hover)' }} /> : <Unlock size={16} style={{ color: 'var(--text-dark)' }} />}
                      Enable Room Password
                    </label>
                    <input 
                      id="password-toggle"
                      type="checkbox" 
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      checked={usePassword} 
                      onChange={(e) => setUsePassword(e.target.checked)} 
                    />
                  </div>

                  {usePassword && (
                    <div style={{ textAlign: 'left', marginTop: '16px' }}>
                      <label className="form-label" htmlFor="create-pwd">Room Password</label>
                      <input
                        id="create-pwd"
                        type="password"
                        placeholder="Choose room password"
                        className="form-input"
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>

                <button type="submit" className="submit-btn" disabled={loading}>
                  <Plus size={18} />
                  <span>{loading ? 'Creating...' : 'Create Watch Party'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleInspectRoom}>
                <div className="form-group">
                  <label className="form-label" htmlFor="code-input">Room Code</label>
                  <input
                    id="code-input"
                    type="text"
                    placeholder="Enter Room Code (e.g. 3F8H8A)"
                    className="form-input"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="submit-btn" style={{ marginTop: '24px' }} disabled={loading}>
                  <UserPlus size={18} />
                  <span>{loading ? 'Validating...' : 'Join Party'}</span>
                </button>
              </form>
            )}
          </>
        ) : (
          <form onSubmit={handleJoinWithPassword}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label" htmlFor="join-pwd-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'none' }}>
                <Lock size={16} style={{ color: 'var(--accent-rose)' }} />
                Locked Room. Please enter password:
              </label>
              <input
                id="join-pwd-input"
                type="password"
                placeholder="Enter password"
                className="form-input"
                style={{ marginTop: '12px' }}
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <button 
                type="button" 
                className="copy-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  setPasswordRequired(false);
                  setJoinPassword('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="submit-btn" style={{ flex: 1 }} disabled={loading}>
                {loading ? 'Entering...' : 'Unlock & Join'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
