import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, UserPlus } from 'lucide-react';

export const LoginPage = () => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'signin') {
        // Reuse 'email' state variable as 'identity' (supports username or email login)
        await login(email, password);
      } else {
        await register(username, email, password);
      }
    } catch (err) {
      console.error('Authentication attempt failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lobby-wrapper">
      <div className="glass-panel lobby-card">
        <span className="lobby-logo">🍿</span>
        <h1 className="lobby-title">SyncParty</h1>
        <p className="lobby-subtitle">Real-time synchronized YouTube watch parties.</p>

        <div className="lobby-tabs">
          <button
            type="button"
            className={`lobby-tab ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`lobby-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => setTab('signup')}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">Choose Username</label>
              <input
                id="reg-username"
                type="text"
                placeholder="e.g. Alex"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={15}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="identity-input">
              {tab === 'signin' ? 'Username or Email' : 'Email Address'}
            </label>
            <input
              id="identity-input"
              type="text"
              placeholder={tab === 'signin' ? "e.g. alex or alex@domain.com" : "e.g. alex@domain.com"}
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password</label>
            <input
              id="password-input"
              type="password"
              placeholder="••••••••"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="submit-btn" style={{ marginTop: '24px' }} disabled={loading}>
            {loading ? (
              <span>Connecting...</span>
            ) : tab === 'signin' ? (
              <>
                <UserPlus size={18} />
                <span>Enter Lobby</span>
              </>
            ) : (
              <>
                <Plus size={18} />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
