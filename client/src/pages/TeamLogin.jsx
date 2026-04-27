import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';

export default function TeamLogin() {
  const navigate = useNavigate();
  const { gameState, connected } = useGame('player');
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { const s = localStorage.getItem('gg-team-id'); if (s) setSelectedId(s); }, []);

  const handleEnter = () => {
    if (!selectedId) { setError('Select your team first.'); return; }
    const team = gameState?.teams?.find(t => t.id === selectedId);
    if (!team) { setError('Team not found.'); return; }
    localStorage.setItem('gg-team-id', selectedId);
    localStorage.setItem('gg-team-name', team.name);
    navigate('/play');
  };

  const teams = gameState?.teams || [];
  const phase = gameState?.phase || 'setup';
  const round = gameState?.currentRound || 0;

  return (
    <div style={S.page}>
      <div style={S.bg} />
      <div style={S.container}>
        {/* Logo */}
        <div style={S.logo}>
          <span style={S.suit}>♠</span>
          <div style={{ textAlign:'center' }}>
            <h1 style={S.title}>GRID GAMBIT</h1>
            <p style={S.sub}>The Technical Bingo Arena</p>
          </div>
          <span style={S.suit}>♦</span>
        </div>

        {/* Divider */}
        <div style={S.divider}><div style={S.divLine}/><span style={S.divText}>ENTER THE ARENA</span><div style={S.divLine}/></div>

        {/* Status */}
        <div style={S.statusRow}>
          <div style={{ ...S.dot, background: connected ? '#22c55e' : '#ef4444' }} />
          <span style={S.statusText}>
            {!connected ? 'Connecting...' : phase === 'round_active' ? `Round ${round} in Progress` : phase === 'round_end' ? `Round ${round} Ended` : phase === 'finished' ? 'Game Finished' : 'Lobby Open'}
          </span>
        </div>

        {/* Card */}
        <div style={S.card}>
          <p style={S.cardLabel}>SELECT YOUR TEAM</p>
          {teams.length === 0 ? (
            <p style={S.noTeams}>No teams yet. Ask the host to add your team.</p>
          ) : (
            <div style={S.teamList}>
              {teams.map(team => (
                <button key={team.id} onClick={() => setSelectedId(team.id)}
                  style={{ ...S.teamBtn, ...(selectedId === team.id ? { borderColor: team.color, background:`${team.color}12`, boxShadow:`0 0 20px ${team.color}20` } : {}) }}>
                  <div style={{ ...S.teamDot, background: team.color }} />
                  <span style={S.teamName}>{team.name}</span>
                  <span style={S.teamScore}>{team.totalScore || 0} pts</span>
                  {selectedId === team.id && <span style={{ color:'var(--gold)', fontWeight:700 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          {error && <p style={S.err}>{error}</p>}
          <button onClick={handleEnter} disabled={!selectedId || !connected}
            style={{ ...S.enterBtn, ...(selectedId && connected ? S.enterActive : {}) }}>
            Enter Game
          </button>
        </div>

        <div style={S.navLinks}>
          <a href="/admin" style={S.navLink}>Admin Panel</a>
          <span style={{ color:'var(--gold)', opacity:0.3, fontSize:'0.5rem' }}>◆</span>
          <a href="/leaderboard" style={S.navLink}>Leaderboard</a>
        </div>
      </div>
    </div>
  );
}

const S = {
  page:      { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', padding:'20px', background:'radial-gradient(ellipse at center,#061812 0%,#020608 70%)' },
  bg:        { position:'fixed', inset:0, pointerEvents:'none', backgroundImage:'repeating-linear-gradient(45deg,rgba(212,175,55,0.03) 0,rgba(212,175,55,0.03) 1px,transparent 0,transparent 50%),repeating-linear-gradient(-45deg,rgba(212,175,55,0.03) 0,rgba(212,175,55,0.03) 1px,transparent 0,transparent 50%)', backgroundSize:'30px 30px' },
  container: { width:'100%', maxWidth:'460px', display:'flex', flexDirection:'column', gap:'22px', position:'relative', zIndex:1, animation:'fadeIn 0.6s ease' },
  logo:      { display:'flex', alignItems:'center', justifyContent:'center', gap:'20px' },
  suit:      { fontSize:'2.5rem', color:'var(--gold)', opacity:0.55, textShadow:'0 0 20px rgba(212,175,55,0.3)' },
  title:     { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'2.8rem', color:'var(--gold)', letterSpacing:'0.12em', textShadow:'0 0 40px rgba(212,175,55,0.4)', lineHeight:1 },
  sub:       { fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)', letterSpacing:'0.2em', textTransform:'uppercase', marginTop:'5px' },
  divider:   { display:'flex', alignItems:'center', gap:'12px' },
  divLine:   { flex:1, height:'1px', background:'linear-gradient(to right,transparent,rgba(212,175,55,0.3),transparent)' },
  divText:   { fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:'var(--gold)', letterSpacing:'0.2em', opacity:0.7, whiteSpace:'nowrap' },
  statusRow: { display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' },
  dot:       { width:'8px', height:'8px', borderRadius:'50%', boxShadow:'0 0 8px currentColor' },
  statusText:{ fontFamily:'var(--font-mono)', fontSize:'0.73rem', color:'var(--text-dim)', letterSpacing:'0.08em' },
  card:      { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-xl)', padding:'26px', boxShadow:'var(--shadow-deep)', display:'flex', flexDirection:'column', gap:'14px' },
  cardLabel: { fontFamily:'var(--font-mono)', fontSize:'0.62rem', letterSpacing:'0.2em', color:'var(--gold)', textTransform:'uppercase', opacity:0.8 },
  noTeams:   { fontFamily:'var(--font-body)', fontSize:'1rem', color:'var(--text-dim)', textAlign:'center', padding:'16px 0' },
  teamList:  { display:'flex', flexDirection:'column', gap:'7px' },
  teamBtn:   { display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'rgba(10,24,18,0.8)', border:'1px solid rgba(212,175,55,0.14)', borderRadius:'10px', cursor:'pointer', transition:'all 0.18s ease', width:'100%', textAlign:'left' },
  teamDot:   { width:'10px', height:'10px', borderRadius:'50%', flexShrink:0 },
  teamName:  { fontFamily:'var(--font-display)', fontWeight:600, fontSize:'1.05rem', color:'var(--text)', flex:1 },
  teamScore: { fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--text-muted)' },
  err:       { fontFamily:'var(--font-mono)', fontSize:'0.76rem', color:'#ef4444', textAlign:'center' },
  enterBtn:  { padding:'14px', borderRadius:'10px', border:'1px solid rgba(212,175,55,0.18)', background:'rgba(212,175,55,0.04)', color:'var(--text-muted)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.08rem', letterSpacing:'0.1em', cursor:'not-allowed', transition:'all 0.22s ease' },
  enterActive:{ background:'linear-gradient(135deg,#d4af37 0%,#a07820 100%)', color:'#000', border:'1px solid #d4af37', cursor:'pointer', boxShadow:'0 6px 25px rgba(212,175,55,0.35)' },
  navLinks:  { display:'flex', alignItems:'center', justifyContent:'center', gap:'16px' },
  navLink:   { fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--text-muted)', textDecoration:'none', letterSpacing:'0.1em' },
};
