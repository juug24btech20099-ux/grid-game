import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TeamLogin from './pages/TeamLogin.jsx';
import PlayerDashboard from './pages/PlayerDashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TeamLogin />} />
      <Route path="/play" element={<PlayerDashboard />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
