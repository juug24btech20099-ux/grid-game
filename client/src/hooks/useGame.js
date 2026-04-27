import { useState, useEffect } from 'react';
import socket from '../socket.js';

export function useGame(role = 'player') {
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.emit('client:join', { role });
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onState      = (s) => setGameState(s);
    const onTick       = ({ teams }) => setGameState(prev => {
      if (!prev) return prev;
      return { ...prev, teams: prev.teams.map(t => { const tick = teams.find(x => x.id === t.id); return tick ? { ...t, elapsedSeconds: tick.elapsedSeconds } : t; }) };
    });
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state:update', onState);
    socket.on('state:tick', onTick);
    if (socket.connected) setConnected(true);
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('state:update', onState); socket.off('state:tick', onTick); };
  }, [role]);

  return { gameState, connected };
}
