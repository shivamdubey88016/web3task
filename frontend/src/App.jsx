import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { RoomPage } from './pages/RoomPage';
import { ShieldAlert } from 'lucide-react';

function MainAppContent() {
  const { user, loading, errorToast } = useAuth();
  const [view, setView] = useState('LOBBY');
  const [activeRoomId, setActiveRoomId] = useState('');
  const [myInitialRole, setMyInitialRole] = useState('Participant');

  if (loading) {
    return (
      <div className="lobby-wrapper">
        <div style={{ textAlign: 'center' }}>
          <span className="lobby-logo" style={{ fontSize: '3rem', display: 'inline-block' }}>🍿</span>
          <p className="lobby-subtitle" style={{ marginTop: '16px' }}>Restoring Watch Party session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleJoinSuccess = (code, role) => {
    setActiveRoomId(code);
    setMyInitialRole(role);
    setView('ROOM');
    
    // Auto-update browser URL bar with invite code parameters
    const newUrl = `${window.location.origin}?room=${code}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleLeaveRoom = () => {
    setView('LOBBY');
    setActiveRoomId('');
    
    // Clear invite parameters from URL bar on leave
    const newUrl = window.location.origin;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  return (
    <div className="app-container">
      {/* Toast notifications */}
      {errorToast && (
        <div className="toast-msg">
          <ShieldAlert size={18} />
          <span>{errorToast}</span>
        </div>
      )}

      {view === 'LOBBY' ? (
        <LandingPage onJoinSuccess={handleJoinSuccess} />
      ) : (
        <RoomPage 
          roomId={activeRoomId} 
          initialRole={myInitialRole} 
          onLeave={handleLeaveRoom} 
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
