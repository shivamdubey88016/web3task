import React, { useEffect, useRef } from 'react';
import { Lock, Crown, ShieldCheck } from 'lucide-react';

export const YouTubePlayer = ({
  videoId,
  isController,
  myRole,
  socket,
  showToast,
}) => {
  const playerRef = useRef(null);
  const isSyncingRef = useRef(false);
  const localTimeTrackerRef = useRef(0);
  const timeSyncIntervalRef = useRef(null);
  const elementId = 'youtube-player';

  // Instantiate YouTube IFrame Player
  const initPlayer = (id) => {
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (err) {
        console.error(err);
      }
      playerRef.current = null;
    }

    const createPlayer = () => {
      playerRef.current = new window.YT.Player(elementId, {
        videoId: id,
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 0,
          fs: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            console.log('YouTube Iframe Player ready');
            socket?.emit('request_sync');
          },
          onStateChange: (event) => {
            const playerState = event.data;
            if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;
            const time = playerRef.current.getCurrentTime();

            // Prevent event feedback loops
            if (isSyncingRef.current) {
              isSyncingRef.current = false;
              return;
            }

            if (isController && socket) {
              if (playerState === window.YT.PlayerState.PLAYING) {
                socket.emit('play', { currentTime: time });
              } else if (playerState === window.YT.PlayerState.PAUSED) {
                socket.emit('pause', { currentTime: time });
              }
            }
          }
        }
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = createPlayer;
    } else {
      createPlayer();
    }
  };

  // Re-load player if videoId changes
  useEffect(() => {
    initPlayer(videoId);
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (err) {}
        playerRef.current = null;
      }
    };
  }, [videoId]);

  // Bind Socket Listeners for real-time play/pause/seek/sync
  useEffect(() => {
    if (!socket) return;

    socket.on('play', ({ currentTime, userId }) => {
      if (userId === socket.id) return;
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        isSyncingRef.current = true;
        const localTime = playerRef.current.getCurrentTime();
        if (Math.abs(localTime - currentTime) > 1.5) {
          playerRef.current.seekTo(currentTime, true);
        }
        playerRef.current.playVideo();
      }
    });

    socket.on('pause', ({ currentTime, userId }) => {
      if (userId === socket.id) return;
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        isSyncingRef.current = true;
        const localTime = playerRef.current.getCurrentTime();
        if (Math.abs(localTime - currentTime) > 1.5) {
          playerRef.current.seekTo(currentTime, true);
        }
        playerRef.current.pauseVideo();
      }
    });

    socket.on('seek', ({ currentTime, userId }) => {
      if (userId === socket.id) return;
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        isSyncingRef.current = true;
        playerRef.current.seekTo(currentTime, true);
      }
    });

    socket.on('sync_state', (state) => {
      if (!playerRef.current || typeof playerRef.current.getPlayerState !== 'function') return;
      
      const expectedState = state.playState === 'PLAYING' ? window.YT.PlayerState.PLAYING : window.YT.PlayerState.PAUSED;
      const playerState = playerRef.current.getPlayerState();
      
      const localTime = playerRef.current.getCurrentTime();
      const diff = Math.abs(localTime - state.currentTime);
      
      if (diff > 2) {
        isSyncingRef.current = true;
        playerRef.current.seekTo(state.currentTime, true);
      }

      if (playerState !== expectedState) {
        isSyncingRef.current = true;
        if (expectedState === window.YT.PlayerState.PLAYING) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      }
    });

    return () => {
      socket.off('play');
      socket.off('pause');
      socket.off('seek');
      socket.off('sync_state');
    };
  }, [socket]);

  // Periodic Local Time Tracking to detect scrub/seeks by Host/Moderator
  useEffect(() => {
    timeSyncIntervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const currentTime = playerRef.current.getCurrentTime();
        const prevTime = localTimeTrackerRef.current;
        const playerState = playerRef.current.getPlayerState();

        if (isController && !isSyncingRef.current && playerState !== -1) {
          const diff = Math.abs(currentTime - prevTime);
          // If scrubbed > 2.0s, emit seek event
          if (diff > 2.0) {
            console.log('User scrub detected from', prevTime, 'to', currentTime);
            socket?.emit('seek', { currentTime });
          }
        }
        localTimeTrackerRef.current = currentTime;
      }
    }, 500);

    return () => {
      if (timeSyncIntervalRef.current) {
        clearInterval(timeSyncIntervalRef.current);
      }
    };
  }, [isController, socket]);

  return (
    <div className="glass-panel player-outer-container">
      <div className="video-aspect-ratio">
        <div id={elementId} className="youtube-iframe-container"></div>
        
        {/* Glass Interception Shield for watch-only guests */}
        {!isController && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: '48px',
              zIndex: 10,
              background: 'transparent',
              cursor: 'not-allowed'
            }}
            onClick={() => showToast("Playback locked in Sync. Only the Host or Moderators can control playback.")}
          ></div>
        )}
      </div>
      
      {/* Playback HUD */}
      <div className="control-indicator-bar">
        <div className={`indicator-role-badge ${myRole.toLowerCase()}`}>
          {myRole === 'Host' ? <Crown size={14} /> : myRole === 'Moderator' ? <ShieldCheck size={14} /> : <Lock size={14} />}
          <span>My Role: {myRole}</span>
        </div>

        <div className="sync-status-indicator">
          <span className="sync-pulse"></span>
          <span>Real-time Synced</span>
        </div>
      </div>
    </div>
  );
};
