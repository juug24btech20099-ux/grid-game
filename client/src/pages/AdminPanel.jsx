import React, { useState, useEffect } from 'react';
import { useGame } from '../hooks/useGame.js';
import { formatTime } from '../components/Timer.jsx';
import socket from '../socket.js';

const ADMIN_CODE = 'ADMIN2025';
const PALETTE = ['#d4af37','#22c55e','#38bdf8','#f472b6','#a78bfa','#f97316','#34d399','#fb7185','#60a5fa','#fbbf24'];

export default function AdminPanel() {
  const { gameState, connected } = useGame('admin');
  const [auth, setAuth]         = useState(() => sessionStorage.getItem('gg-admin') === ADMIN_CODE);
  const [inputCode, setCode]    = useState('');
  const [authErr, setAuthErr]   = useState('');
  const [newName, setNewName]   = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [duration, setDuration] = useState(40);
  const [autoEnd, setAutoEnd]   = useState(true);
  const [srvErr, setSrvErr]     = useState('');

  useEffect(() => {
    const onErr = ({ msg }) => { setSrvErr(msg); setTimeout(() => setSrvErr(''), 4000); };
    socket.on('error', onErr);
    return () => socket.off('error', onErr);
  }, []);

  const emit = (ev, extra = {}) => socket.emit(ev, { adminCode: ADMIN_CODE, ...extra });

  if (!auth) return (
    <div style={S.authPage}>
      <div style={S.authCard}>
        <div style={S.authLogo}>GRID GAMBIT</div>
        <p style={S.authSub}>Admin Access</p>
        <input type="password" placeholder="Enter admin code" value={inputCode}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter') tryAuth(); }}
          style={S.authInput} />
        {authErr && <p style={S.authErr}>{authErr}</p>}
        <button onClick={tryAuth} style={S.authBtn}>Enter</button>
      </div>
    </div>
  );

  function tryAuth() {
    if (inputCode === ADMIN_CODE) { sessionStorage.setItem('gg-admin', ADMIN_CODE); setAuth(true); }
    else setAuthErr('Invalid code');
  }

  const phase  = gameState?.phase  || 'setup';
  const round  = gameState?.currentRound || 0;
  const total  = gameState?.totalRounds  || 3;
  const teams  = gameState?.teams        || [];
  const anns   = gameState?.announcements || [];
  const hack   = gameState?.globalHack;

  const phaseColor = { setup:'var(--text-dim)', round_active:'#22c55e', round_end:'var(--gold)', finished:'#f472b6' }[phase] || 'var(--text-dim)';

  return (
    <div style={S.page}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sbLogo}><span style={S.sbTitle}>GRID GAMBIT</span><span style={S.sbSub}>Admin Console</span></div>

        <div style={S.connRow}>
          <div style={{ ...S.dot, background: connected?'#22c55e':'#ef4444' }} />
          <span style={S.connTxt}>{connected?'Connected':'Disconnected'}</span>
        </div>

        {srvErr && <div style={S.errBox}>{srvErr}</div>}

        <div style={S.phaseRow}>
          <span style={{ ...S.phaseText, color: phaseColor }}>{phase.replace('_',' ').toUpperCase()}</span>
          {round > 0 && <span style={S.roundBadge}>ROUND {round}/{total}</span>}
        </div>

        {/* Game controls */}
        <div style={S.sec}>
          <p style={S.secTitle}>GAME CONTROLS</p>
          <div style={S.formRow}>
            <label style={S.label}>Round duration (min)</label>
            <input type="number" value={duration} min={10} max={120} onChange={e=>setDuration(+e.target.value)} style={S.input} disabled={phase==='round_active'} />
          </div>
          <label style={S.checkRow}>
            <input type="checkbox" checked={autoEnd} onChange={e=>setAutoEnd(e.target.checked)} style={S.checkbox} disabled={phase==='round_active'} />
            <span style={S.checkLabel}>Auto-end round when winner reaches 5 lines</span>
          </label>

          <div style={S.btnRow}>
            {phase === 'setup' && <button onClick={() => emit('admin:startGame',{roundDurationMinutes:duration,autoEndOnWinner:autoEnd})} disabled={!teams.length} style={S.btnGold}>▶ Start Game</button>}
            {phase === 'round_active' && <button onClick={() => emit('admin:endRound')} style={S.btnDanger}>■ End Round</button>}
            {phase === 'round_end' && round < total && <button onClick={() => emit('admin:startRound',{round:round+1})} style={S.btnGold}>▶ Round {round+1}</button>}
            {phase === 'round_end' && round >= total && <button onClick={() => emit('admin:endGame')} style={S.btnGold}>🏆 End Game</button>}
            {phase === 'finished' && <button onClick={() => { if(confirm('Reset everything?')) emit('admin:reset'); }} style={S.btnGhost}>↺ Reset</button>}
            {phase !== 'setup' && phase !== 'finished' && <button onClick={() => { if(confirm('Reset?')) emit('admin:reset'); }} style={S.btnGhost}>↺</button>}
          </div>
        </div>

        {/* Global Hack */}
        <div style={S.sec}>
          <p style={S.secTitle}>GLOBAL HACK EVENT</p>
          {hack?.active
            ? <div style={S.hackActive}>⚡ HACK ACTIVE — {hack.solvers.length}/3 solved</div>
            : <button onClick={() => emit('admin:triggerHack')} disabled={phase!=='round_active'} style={phase==='round_active'?S.btnHack:S.btnGhost}>⚡ Trigger Global Hack</button>
          }
          <p style={S.secHint}>Fires a bonus question to all teams. First 3 correct get +2 tokens.</p>
        </div>

        {/* Projector toggle */}
        <div style={S.sec}>
          <p style={S.secTitle}>PROJECTOR</p>
          <button onClick={() => emit('admin:toggleLeaderboard',{visible:!gameState?.leaderboardVisible})}
            style={{ ...S.btnToggle, background:gameState?.leaderboardVisible?'rgba(34,197,94,0.1)':'rgba(212,175,55,0.07)', borderColor:gameState?.leaderboardVisible?'rgba(34,197,94,0.4)':'rgba(212,175,55,0.28)', color:gameState?.leaderboardVisible?'#22c55e':'var(--gold)' }}>
            {gameState?.leaderboardVisible ? '👁 Leaderboard Visible' : '🎰 Title Screen Showing'}
          </button>
          <a href="/leaderboard" target="_blank" style={S.projLink}>Open Projector View ↗</a>
        </div>

        {/* Add team */}
        <div style={S.sec}>
          <p style={S.secTitle}>ADD TEAM</p>
          <input type="text" placeholder="Team name" value={newName} onChange={e=>setNewName(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter'&&newName.trim()){ emit('admin:addTeam',{name:newName.trim(),color:newColor}); setNewName(''); }}}
            style={S.input} />
          <div style={S.colorPicker}>
            {PALETTE.map(c=>(
              <button key={c} onClick={()=>setNewColor(c)} style={{ ...S.colorDot, background:c, transform:newColor===c?'scale(1.35)':'scale(1)', boxShadow:newColor===c?`0 0 8px ${c}`:'none' }} />
            ))}
          </div>
          <button onClick={() => { if(newName.trim()){ emit('admin:addTeam',{name:newName.trim(),color:newColor}); setNewName(''); }}} disabled={!newName.trim()} style={S.btnGold}>+ Add Team</button>
        </div>

        {/* Feed */}
        <div style={S.sec}>
          <div style={S.secRow}><p style={S.secTitle}>FEED</p><button onClick={()=>emit('admin:clearAnnouncements')} style={S.btnTiny}>Clear</button></div>
          <div style={S.feed}>
            {anns.length===0 ? <p style={S.feedEmpty}>No events yet.</p> : anns.map(a=>(
              <div key={a.id} style={{ ...S.feedItem, borderColor:feedCol(a.type) }}>
                <span style={{ ...S.feedType, color:feedCol(a.type) }}>{a.type}</span>
                <span style={S.feedTitle}>{a.title}</span>
                <span style={S.feedDetail}>{a.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        <div style={S.mainHdr}>
          <h2 style={S.mainTitle}>Live Teams</h2>
          <span style={S.teamCount}>{teams.length} team{teams.length!==1?'s':''}</span>
          {/* Round scores header */}
          {round > 0 && (
            <div style={S.roundSummary}>
              {Array.from({length:total},(_,i)=>(
                <span key={i} style={{ ...S.rsBadge, opacity: i<round?1:0.3 }}>R{i+1}</span>
              ))}
            </div>
          )}
        </div>

        <div style={S.teamGrid}>
          {teams.length === 0 ? (
            <div style={S.empty}><p style={S.emptyIcon}>♠</p><p style={S.emptyTxt}>No teams yet. Add from the sidebar.</p></div>
          ) : [...teams].sort((a,b)=>(b.totalScore||0)-(a.totalScore||0)).map((team, rank) => (
            <div key={team.id} style={{ ...S.teamCard, borderColor:`${team.color}30` }}>
              <div style={S.tcHdr}>
                <div style={S.tcLeft}>
                  <div style={{ ...S.rankBadge, background:`${team.color}18`, color:team.color }}>#{rank+1}</div>
                  <div>
                    <div style={{ ...S.tcName, color:team.color }}>{team.name}</div>
                    <div style={S.tcId}>{team.id.slice(0,8)}</div>
                  </div>
                </div>
                <button onClick={()=>{ if(confirm(`Remove ${team.name}?`)) emit('admin:removeTeam',{teamId:team.id}); }} style={S.removeBtn}>✕</button>
              </div>

              <div style={S.tcStats}>
                {[['SCORE',team.totalScore||0,'var(--gold)'],['LINES',team.linesCompleted,team.color],['TOKENS',team.tokens??12,(team.tokens??12)<=3?'#ef4444':'#22c55e'],['TIME',formatTime(team.elapsedSeconds||0),'var(--text-dim)']].map(([l,v,c])=>(
                  <div key={l} style={S.stat}><span style={{ ...S.statV, color:c }}>{v}</span><span style={S.statL}>{l}</span></div>
                ))}
              </div>

              {/* Round scores row */}
              {(team.roundScores?.length > 0) && (
                <div style={S.rsRow}>
                  {team.roundScores.map((pts,i)=>(
                    <div key={i} style={S.rsPill}><span style={S.rsPillL}>R{i+1}</span><span style={S.rsPillV}>{pts}</span></div>
                  ))}
                </div>
              )}

              {/* Power-ups */}
              {(team.powerups?.length > 0) && (
                <div style={S.puRow}>{team.powerups.map((p,i)=><span key={i} style={S.puBadge}>❄️ {p.toUpperCase()}</span>)}</div>
              )}

              {/* Frozen indicator */}
              {team.isFrozen && <div style={S.frozenTag}>❄️ FROZEN</div>}

              {/* Mini grid */}
              <div style={S.miniGrid}>
                {Array.from({length:25},(_,i)=>{
                  const marked = team.markedCells?.includes(i);
                  const inLine = team.lines?.some(l=>l.cells?.includes(i));
                  return <div key={i} style={{ ...S.miniCell, background:inLine?`${team.color}40`:marked?'rgba(212,175,55,0.2)':'rgba(10,24,18,0.8)', border:`1px solid ${inLine?team.color:marked?'rgba(212,175,55,0.3)':'rgba(212,175,55,0.07)'}` }} />;
                })}
              </div>

              {gameState?.roundWinners?.[round]?.includes(team.id) && (
                <div style={{ ...S.winTag, color:team.color, borderColor:`${team.color}40` }}>🏆 ROUND {round} WINNER</div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function feedCol(t) { return {start:'#22c55e',winner:'#d4af37',correct:'#34d399',miss:'#f87171',team:'#60a5fa',end:'#f59e0b',hack:'#f472b6',hack_solve:'#fbbf24',powerup:'#a78bfa',freeze:'#38bdf8',round_start:'#22c55e',round_end:'#d4af37'}[t]||'var(--text-dim)'; }

const S = {
  authPage:   { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'radial-gradient(ellipse at center,#061812 0%,#020608 70%)' },
  authCard:   { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'20px', padding:'40px', display:'flex', flexDirection:'column', gap:'16px', width:'320px', textAlign:'center', boxShadow:'var(--shadow-deep)' },
  authLogo:   { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1.6rem', color:'var(--gold)', letterSpacing:'0.12em', textShadow:'0 0 30px rgba(212,175,55,0.4)' },
  authSub:    { fontFamily:'var(--font-mono)', fontSize:'0.73rem', color:'var(--text-muted)', letterSpacing:'0.15em', textTransform:'uppercase' },
  authInput:  { padding:'12px 16px', background:'rgba(10,24,18,0.8)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontFamily:'var(--font-mono)', fontSize:'0.9rem', outline:'none', textAlign:'center', letterSpacing:'0.2em' },
  authErr:    { fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'#ef4444' },
  authBtn:    { padding:'12px', background:'linear-gradient(135deg,#d4af37,#a07820)', color:'#000', border:'none', borderRadius:'8px', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem', cursor:'pointer', letterSpacing:'0.08em' },
  page:       { minHeight:'100vh', display:'flex', background:'#020608' },
  sidebar:    { width:'290px', flexShrink:0, background:'rgba(4,12,8,0.98)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflowY:'auto', paddingBottom:'20px' },
  sbLogo:     { padding:'18px 18px 14px', borderBottom:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'3px' },
  sbTitle:    { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1.15rem', color:'var(--gold)', letterSpacing:'0.1em', textShadow:'0 0 20px rgba(212,175,55,0.3)' },
  sbSub:      { fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-muted)', letterSpacing:'0.15em', textTransform:'uppercase' },
  connRow:    { display:'flex', alignItems:'center', gap:'8px', padding:'9px 18px', borderBottom:'1px solid rgba(212,175,55,0.05)' },
  dot:        { width:'7px', height:'7px', borderRadius:'50%' },
  connTxt:    { fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-dim)' },
  errBox:     { margin:'8px 14px', padding:'8px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', fontFamily:'var(--font-mono)', fontSize:'0.73rem', color:'#ef4444' },
  phaseRow:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 18px', borderBottom:'1px solid rgba(212,175,55,0.05)' },
  phaseText:  { fontFamily:'var(--font-mono)', fontSize:'0.63rem', letterSpacing:'0.2em', fontWeight:600 },
  roundBadge: { fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--gold)', background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.25)', padding:'3px 8px', borderRadius:'12px', letterSpacing:'0.1em' },
  sec:        { padding:'14px 18px', borderBottom:'1px solid rgba(212,175,55,0.05)', display:'flex', flexDirection:'column', gap:'9px' },
  secTitle:   { fontFamily:'var(--font-mono)', fontSize:'0.6rem', letterSpacing:'0.2em', color:'var(--gold)', opacity:0.7, textTransform:'uppercase' },
  secHint:    { fontFamily:'var(--font-body)', fontSize:'0.82rem', color:'var(--text-muted)', lineHeight:1.4 },
  secRow:     { display:'flex', alignItems:'center', justifyContent:'space-between' },
  formRow:    { display:'flex', flexDirection:'column', gap:'4px' },
  label:      { fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', letterSpacing:'0.07em' },
  input:      { padding:'8px 11px', background:'rgba(10,24,18,0.9)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'7px', color:'var(--text)', fontFamily:'var(--font-mono)', fontSize:'0.83rem', outline:'none', width:'100%' },
  checkRow:   { display:'flex', alignItems:'flex-start', gap:'8px', cursor:'pointer' },
  checkbox:   { marginTop:'3px', accentColor:'var(--gold)', flexShrink:0 },
  checkLabel: { fontFamily:'var(--font-body)', fontSize:'0.86rem', color:'var(--text-dim)', lineHeight:1.4 },
  btnRow:     { display:'flex', gap:'7px' },
  btnGold:    { flex:1, padding:'9px', background:'linear-gradient(135deg,#d4af37,#a07820)', color:'#000', border:'none', borderRadius:'7px', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.86rem', letterSpacing:'0.05em', cursor:'pointer', transition:'opacity 0.2s' },
  btnDanger:  { flex:1, padding:'9px', background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'7px', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.86rem', cursor:'pointer' },
  btnGhost:   { padding:'9px 13px', background:'transparent', color:'var(--text-dim)', border:'1px solid rgba(212,175,55,0.14)', borderRadius:'7px', fontFamily:'var(--font-mono)', fontSize:'0.78rem', cursor:'pointer' },
  btnHack:    { width:'100%', padding:'10px', background:'rgba(244,114,182,0.12)', color:'#f472b6', border:'1px solid rgba(244,114,182,0.35)', borderRadius:'8px', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', letterSpacing:'0.06em', animation:'hackAlert 2s ease infinite' },
  hackActive: { padding:'10px', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.4)', borderRadius:'8px', fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'#fbbf24', textAlign:'center', letterSpacing:'0.06em' },
  btnTiny:    { padding:'3px 9px', background:'transparent', color:'var(--text-muted)', border:'1px solid rgba(212,175,55,0.14)', borderRadius:'5px', fontFamily:'var(--font-mono)', fontSize:'0.63rem', cursor:'pointer' },
  btnToggle:  { width:'100%', padding:'9px', border:'1px solid', borderRadius:'8px', fontFamily:'var(--font-mono)', fontSize:'0.76rem', letterSpacing:'0.06em', cursor:'pointer', transition:'all 0.2s ease' },
  projLink:   { fontFamily:'var(--font-mono)', fontSize:'0.66rem', color:'var(--text-muted)', textDecoration:'none', textAlign:'center', letterSpacing:'0.08em' },
  colorPicker:{ display:'flex', gap:'7px', flexWrap:'wrap' },
  colorDot:   { width:'21px', height:'21px', borderRadius:'50%', border:'none', cursor:'pointer', transition:'transform 0.2s,box-shadow 0.2s', flexShrink:0 },
  feed:       { maxHeight:'200px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'4px' },
  feedEmpty:  { fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--text-muted)', textAlign:'center', padding:'10px 0' },
  feedItem:   { padding:'6px 9px', background:'rgba(10,24,18,0.7)', borderRadius:'6px', borderLeft:'2px solid', display:'flex', flexDirection:'column', gap:'2px' },
  feedType:   { fontFamily:'var(--font-mono)', fontSize:'0.58rem', letterSpacing:'0.14em', textTransform:'uppercase', fontWeight:600 },
  feedTitle:  { fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.8rem', color:'var(--text)' },
  feedDetail: { fontFamily:'var(--font-body)', fontSize:'0.78rem', color:'var(--text-dim)' },
  main:       { flex:1, padding:'22px', overflow:'auto', display:'flex', flexDirection:'column', gap:'18px' },
  mainHdr:    { display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' },
  mainTitle:  { fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.55rem', color:'var(--gold)', letterSpacing:'0.04em' },
  teamCount:  { fontFamily:'var(--font-mono)', fontSize:'0.73rem', color:'var(--text-muted)', letterSpacing:'0.1em' },
  roundSummary:{ display:'flex', gap:'6px', marginLeft:'auto' },
  rsBadge:    { fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--gold)', background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.2)', padding:'3px 9px', borderRadius:'12px' },
  teamGrid:   { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:'14px' },
  empty:      { gridColumn:'1/-1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px', padding:'70px 40px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'20px' },
  emptyIcon:  { fontSize:'3rem', color:'var(--gold)', opacity:0.3 },
  emptyTxt:   { fontFamily:'var(--font-body)', fontSize:'1.05rem', color:'var(--text-dim)', textAlign:'center' },
  teamCard:   { background:'var(--bg-card)', border:'1px solid', borderRadius:'14px', padding:'14px', display:'flex', flexDirection:'column', gap:'10px', animation:'floatUp 0.4s ease' },
  tcHdr:      { display:'flex', alignItems:'center', justifyContent:'space-between' },
  tcLeft:     { display:'flex', alignItems:'center', gap:'9px' },
  rankBadge:  { width:'26px', height:'26px', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.72rem' },
  tcName:     { fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.98rem' },
  tcId:       { fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-muted)', letterSpacing:'0.04em', marginTop:'2px' },
  removeBtn:  { width:'24px', height:'24px', background:'transparent', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'5px', color:'rgba(239,68,68,0.5)', cursor:'pointer', fontSize:'0.72rem', display:'flex', alignItems:'center', justifyContent:'center' },
  tcStats:    { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'3px' },
  stat:       { display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', padding:'7px 3px', background:'rgba(10,24,18,0.6)', borderRadius:'7px', border:'1px solid rgba(212,175,55,0.07)' },
  statV:      { fontFamily:'var(--font-mono)', fontWeight:600, fontSize:'0.9rem', lineHeight:1 },
  statL:      { fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'var(--text-muted)', letterSpacing:'0.1em' },
  rsRow:      { display:'flex', gap:'5px' },
  rsPill:     { display:'flex', flexDirection:'column', alignItems:'center', gap:'1px', padding:'4px 8px', background:'rgba(212,175,55,0.05)', border:'1px solid rgba(212,175,55,0.12)', borderRadius:'6px' },
  rsPillL:    { fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'var(--text-muted)' },
  rsPillV:    { fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.88rem', color:'var(--gold)' },
  puRow:      { display:'flex', gap:'6px', flexWrap:'wrap' },
  puBadge:    { fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'#38bdf8', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.25)', padding:'3px 9px', borderRadius:'12px' },
  frozenTag:  { textAlign:'center', fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'#38bdf8', background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.3)', padding:'5px', borderRadius:'7px' },
  miniGrid:   { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'2px' },
  miniCell:   { aspectRatio:'1', borderRadius:'3px', transition:'all 0.3s ease' },
  winTag:     { textAlign:'center', fontFamily:'var(--font-mono)', fontSize:'0.67rem', letterSpacing:'0.18em', padding:'5px', borderRadius:'7px', border:'1px solid', animation:'winnerPulse 1.5s ease infinite' },
};
