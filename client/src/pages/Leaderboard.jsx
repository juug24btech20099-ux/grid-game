import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../hooks/useGame.js';
import { formatTime } from '../components/Timer.jsx';
import { startAudio, stopAudio, setVolume, playEffect, resumeCtx } from '../audio/CasinoAudio.js';

// ── Particle burst component ──────────────────────────────────────────────────
function Particles({ active, color = '#d4af37', count = 20 }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (360 / count) * i + Math.random() * 20,
    dist: 60 + Math.random() * 80,
    size: 4 + Math.random() * 6,
    delay: Math.random() * 0.3,
  }));
  if (!active) return null;
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:20 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:'absolute', top:'50%', left:'50%',
          width: p.size, height: p.size, borderRadius:'50%',
          background: color,
          transform: `rotate(${p.angle}deg) translateX(${p.dist}px)`,
          opacity: 0,
          animation: `particleBurst 0.8s ease-out ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Live feed ticker ──────────────────────────────────────────────────────────
function Ticker({ announcements = [] }) {
  const items = announcements.slice(0, 15);
  if (!items.length) return null;
  return (
    <div style={T.ticker}>
      <div style={T.tickerTrack}>
        {[...items, ...items].map((a, i) => (
          <span key={i} style={T.tickerItem}>
            <span style={{ ...T.tickerDot, color: feedColor(a.type) }}>◆</span>
            <span style={{ color: feedColor(a.type) }}>{a.title}</span>
            <span style={T.tickerSep}> — </span>
            {a.detail}
          </span>
        ))}
      </div>
    </div>
  );
}

function feedColor(type) {
  return { winner:'#d4af37', correct:'#22c55e', miss:'#f87171', round_start:'#22c55e', round_end:'#d4af37', hack:'#f472b6', hack_solve:'#fbbf24', powerup:'#a78bfa', freeze:'#38bdf8', start:'#22c55e', end:'#d4af37' }[type] || 'rgba(240,232,208,0.5)';
}

// ── Title screen ──────────────────────────────────────────────────────────────
function TitleScreen({ phase, round, connected }) {
  const [blink, setBlink] = useState(true);
  useEffect(() => { const iv = setInterval(() => setBlink(b => !b), 900); return () => clearInterval(iv); }, []);

  return (
    <div style={TS.page}>
      <div style={TS.bg} />
      {/* Floating suit decorations */}
      {[{s:'♠',t:'8%',l:'6%'},{s:'♦',t:'8%',r:'6%'},{s:'♣',b:'8%',l:'6%'},{s:'♥',b:'8%',r:'6%'}].map((p,i)=>(
        <div key={i} style={{ ...TS.cornerSuit, top:p.t, left:p.l, bottom:p.b, right:p.r, animationDelay:`${i*0.8}s` }}>{p.s}</div>
      ))}
      <div style={TS.content}>
        <div style={TS.suits}>
          {['♠','♥','♣','♦'].map((s,i)=>(
            <span key={i} style={{ ...TS.suit, animationDelay:`${i*0.25}s` }}>{s}</span>
          ))}
        </div>
        <h1 style={TS.title}>GRID GAMBIT</h1>
        <div style={TS.divider}>
          <div style={TS.divLine}/><span style={TS.divDiamond}>◆</span><div style={TS.divLine}/>
        </div>
        <p style={TS.sub}>The Technical Bingo Arena</p>
        <p style={TS.edition}>DevOps · CSE · Cyber-Physical Systems · Cybersecurity</p>
        <div style={{ ...TS.status, opacity: blink ? 1 : 0.3 }}>
          <div style={{ ...TS.statusDot, background: connected ? '#22c55e' : '#ef4444' }} />
          <span style={TS.statusText}>
            {phase === 'round_active' ? `ROUND ${round} IN PROGRESS` : phase === 'round_end' ? `ROUND ${round} COMPLETE` : phase === 'finished' ? 'GAME COMPLETE' : 'READY'}
          </span>
        </div>
      </div>
      <style>{`
        @keyframes suitFloat{0%,100%{transform:translateY(0) scale(1);opacity:0.5}50%{transform:translateY(-18px) scale(1.06);opacity:0.85}}
        @keyframes cornerDrift{0%,100%{opacity:0.06;transform:rotate(0deg)}50%{opacity:0.14;transform:rotate(7deg)}}
      `}</style>
    </div>
  );
}

// ── Main Leaderboard ──────────────────────────────────────────────────────────
export default function Leaderboard() {
  const { gameState, connected } = useGame('projector');
  const [globalTime, setGlobalTime]   = useState(0);
  const [audioOn, setAudioOn]         = useState(false);
  const [volume, setVol]              = useState(35);
  const [burst, setBurst]             = useState({});  // teamId → bool
  const prevPhase   = useRef(null);
  const prevWinners = useRef([]);
  const prevLines   = useRef({});

  // Global elapsed
  useEffect(() => {
    if (gameState?.phase !== 'round_active' || !gameState?.roundStartedAt) return;
    const calc = () => Math.floor((Date.now() - gameState.roundStartedAt) / 1000);
    setGlobalTime(calc());
    const iv = setInterval(() => setGlobalTime(calc()), 1000);
    return () => clearInterval(iv);
  }, [gameState?.phase, gameState?.roundStartedAt]);

  // Sound effects on game events
  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    const round = gameState.currentRound;

    if (prevPhase.current !== phase) {
      if (phase === 'round_active')  playEffect('roundStart');
      if (phase === 'round_end')     playEffect('roundEnd');
      if (phase === 'finished')      playEffect('winner');
      prevPhase.current = phase;
    }

    // Detect new winners for particle burst
    const winners = gameState.roundWinners?.[round] || [];
    winners.forEach(id => {
      if (!prevWinners.current.includes(id)) {
        setBurst(b => ({ ...b, [id]: true }));
        setTimeout(() => setBurst(b => ({ ...b, [id]: false })), 1200);
        playEffect('bingo');
      }
    });
    prevWinners.current = winners;

    // Detect new lines
    gameState.teams?.forEach(t => {
      const prev = prevLines.current[t.id] || 0;
      if (t.linesCompleted > prev) playEffect('correct');
      prevLines.current[t.id] = t.linesCompleted;
    });
  }, [gameState]);

  const toggleAudio = () => {
    resumeCtx();
    if (audioOn) { stopAudio(); setAudioOn(false); }
    else { startAudio(); setAudioOn(true); }
  };

  const handleVolume = (v) => { setVol(v); setVolume(v / 100); };

  if (!gameState) {
    return (
      <div style={L.loadPage}>
        <div style={L.loadTitle}>GRID GAMBIT</div>
        <div style={L.loadDot} />
      </div>
    );
  }

  const visible = gameState.leaderboardVisible;
  const phase   = gameState.phase;
  const round   = gameState.currentRound || 0;
  const total   = gameState.totalRounds || 2;

  if (!visible) return <TitleScreen phase={phase} round={round} connected={connected} />;

  const sorted = [...(gameState.teams || [])].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return (a.elapsedSeconds || 0) - (b.elapsedSeconds || 0);
  });

  const roundWinners = gameState.roundWinners?.[round] || [];

  return (
    <div style={L.page}>
      {/* Top bar */}
      <header style={L.topBar}>
        <div style={L.topLeft}>
          <span style={L.suit}>♠</span>
          <span style={L.topTitle}>GRID GAMBIT</span>
          <span style={L.suit}>♦</span>
        </div>
        <div style={L.topCenter}>
          <span style={L.topSub}>LIVE LEADERBOARD</span>
          {round > 0 && (
            <div style={L.roundIndicator}>
              {Array.from({length:total},(_,i)=>(
                <div key={i} style={{ ...L.roundDot, background: i<round?'var(--gold)':'rgba(212,175,55,0.15)', boxShadow:i+1===round?'0 0 10px var(--gold)':'none' }} />
              ))}
              <span style={L.roundLabel}>Round {round}/{total}</span>
            </div>
          )}
        </div>
        <div style={L.topRight}>
          {phase === 'round_active' && (
            <div style={L.timerBlock}>
              <span style={L.timerVal}>{formatTime(globalTime)}</span>
              <span style={L.timerLbl}>ELAPSED</span>
            </div>
          )}
          <div style={{ ...L.phasePill, background: phase==='round_active'?'rgba(34,197,94,0.14)':'rgba(212,175,55,0.1)', borderColor: phase==='round_active'?'rgba(34,197,94,0.4)':'rgba(212,175,55,0.3)', color: phase==='round_active'?'#22c55e':'var(--gold)' }}>
            {phase.replace('_',' ').toUpperCase()}
          </div>
          {/* Audio controls */}
          <div style={L.audioCtrl}>
            <button onClick={toggleAudio} style={{ ...L.audioBtn, background: audioOn?'rgba(212,175,55,0.15)':'rgba(212,175,55,0.06)', borderColor: audioOn?'rgba(212,175,55,0.5)':'rgba(212,175,55,0.2)' }}>
              {audioOn ? '🔊' : '🔇'}
            </button>
            {audioOn && (
              <input type="range" min={0} max={100} value={volume} onChange={e=>handleVolume(+e.target.value)}
                style={L.volumeSlider} title="Volume" />
            )}
          </div>
        </div>
      </header>

      {/* Decorative divider */}
      <div style={L.hdRow}><div style={L.hdLine}/><span style={L.hdDiamond}>◆</span><div style={L.hdLine}/></div>

      {/* Global hack banner */}
      {gameState.globalHack?.active && (
        <div style={L.hackBanner}>
          <span style={L.hackBannerIcon}>⚡</span>
          <span style={L.hackBannerText}>GLOBAL HACK EVENT ACTIVE — First 3 teams to solve get +2 tokens!</span>
          <span style={L.hackBannerIcon}>⚡</span>
        </div>
      )}

      {/* Table */}
      <main style={L.main}>
        {sorted.length === 0 ? (
          <div style={L.waiting}><div style={L.waitSuits}>♠ ♥ ♣ ♦</div><p style={L.waitText}>Waiting for teams to join...</p></div>
        ) : (
          <div style={L.table}>
            {/* Table header */}
            <div style={L.thead}>
              <span style={L.th}>RANK</span>
              <span style={L.th}>TEAM</span>
              <span style={L.th}>LINES</span>
              <span style={{ ...L.th, textAlign:'center' }}>ROUND SCORES</span>
              <span style={{ ...L.th, textAlign:'center' }}>TOTAL</span>
              <span style={{ ...L.th, textAlign:'center' }}>TIME</span>
              <span style={{ ...L.th, textAlign:'center' }}>STATUS</span>
            </div>

            {sorted.map((team, i) => {
              const isWinner  = roundWinners.includes(team.id);
              const isTop     = i === 0;
              const hasBurst  = burst[team.id];

              return (
                <div key={team.id} style={{
                  ...L.row,
                  borderColor: isWinner ? `${team.color}60` : isTop ? `${team.color}28` : 'rgba(212,175,55,0.09)',
                  background:  isWinner ? `linear-gradient(135deg,${team.color}12,rgba(10,24,18,0.92))` : isTop ? `${team.color}07` : 'rgba(10,24,18,0.65)',
                  boxShadow:   isWinner ? `0 0 35px ${team.color}18` : 'none',
                  animation:   'floatUp 0.4s ease both',
                  animationDelay: `${i*0.04}s`,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <Particles active={hasBurst} color={team.color} count={24} />

                  {/* Rank */}
                  <div style={L.tdRank}>
                    <span style={{ ...L.rankNum, color: i===0?'#d4af37':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--text-muted)', fontSize:i===0?'2.4rem':i<3?'1.8rem':'1.5rem', textShadow:i===0?'0 0 24px rgba(212,175,55,0.6)':'none' }}>
                      {i===0?'①':i===1?'②':i===2?'③':`${i+1}`}
                    </span>
                  </div>

                  {/* Team */}
                  <div style={L.tdTeam}>
                    <div style={{ ...L.colorBar, background:team.color }} />
                    <div>
                      <div style={{ ...L.teamName, color: isWinner?team.color:'var(--text)' }}>{team.name}</div>
                      {team.isFrozen && <span style={L.frozenBadge}>❄️ frozen</span>}
                    </div>
                  </div>

                  {/* Lines with dots */}
                  <div style={L.tdLines}>
                    <div style={L.lineDots}>
                      {Array.from({length:5},(_,j)=>(
                        <div key={j} style={{ ...L.lineDot, background:j<team.linesCompleted?team.color:'rgba(212,175,55,0.1)', boxShadow:j<team.linesCompleted?`0 0 8px ${team.color}80`:'none', transform:j<team.linesCompleted?'scale(1.15)':'scale(1)' }} />
                      ))}
                    </div>
                    <span style={{ ...L.linesNum, color:team.color }}>{team.linesCompleted}/5</span>
                  </div>

                  {/* Round scores */}
                  <div style={L.tdRoundScores}>
                    {Array.from({length:total},(_,ri)=>(
                      <div key={ri} style={{ ...L.rsPill, opacity: ri < round ? 1 : 0.25 }}>
                        <span style={L.rsPillL}>R{ri+1}</span>
                        <span style={L.rsPillV}>{team.roundScores?.[ri] ?? '—'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Total score */}
                  <div style={{ ...L.tdTotal }}>
                    <span style={{ ...L.totalNum, color:isTop?'var(--gold)':team.color }}>{team.totalScore || 0}</span>
                  </div>

                  {/* Time */}
                  <div style={L.tdTime}>
                    <span style={L.timeVal}>{formatTime(team.elapsedSeconds||0)}</span>
                  </div>

                  {/* Status */}
                  <div style={L.tdStatus}>
                    {isWinner ? (
                      <span style={{ ...L.chip, background:`${team.color}20`, color:team.color, borderColor:`${team.color}40`, animation:'winnerPulse 1.5s ease infinite' }}>🏆 WINNER</span>
                    ) : phase==='round_active' ? (
                      <span style={{ ...L.chip, background:'rgba(34,197,94,0.08)', color:'#22c55e', borderColor:'rgba(34,197,94,0.3)' }}>PLAYING</span>
                    ) : (
                      <span style={{ ...L.chip, background:'transparent', color:'var(--text-muted)', borderColor:'rgba(212,175,55,0.12)' }}>WAITING</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Ticker announcements={gameState.announcements || []} />
    </div>
  );
}

// ── Ticker styles ─────────────────────────────────────────────────────────────
const T = {
  ticker:      { height:'38px', overflow:'hidden', background:'rgba(4,12,8,0.97)', borderTop:'1px solid rgba(212,175,55,0.14)', display:'flex', alignItems:'center', flexShrink:0 },
  tickerTrack: { display:'flex', gap:'60px', animation:'tickerScroll 40s linear infinite', whiteSpace:'nowrap', alignItems:'center', paddingLeft:'100%' },
  tickerItem:  { fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-dim)', letterSpacing:'0.05em', display:'flex', alignItems:'center', gap:'8px' },
  tickerDot:   { fontSize:'0.5rem', opacity:0.6 },
  tickerSep:   { color:'var(--text-muted)', opacity:0.5 },
};

// ── Title screen styles ───────────────────────────────────────────────────────
const TS = {
  page:       { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'radial-gradient(ellipse at center,#071510 0%,#020608 70%)', position:'relative', overflow:'hidden' },
  bg:         { position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,rgba(212,175,55,0.025) 0,rgba(212,175,55,0.025) 1px,transparent 0,transparent 50%),repeating-linear-gradient(-45deg,rgba(212,175,55,0.025) 0,rgba(212,175,55,0.025) 1px,transparent 0,transparent 50%)', backgroundSize:'40px 40px' },
  cornerSuit: { position:'absolute', fontSize:'7rem', color:'var(--gold)', fontFamily:'var(--font-display)', animation:'cornerDrift 7s ease infinite' },
  content:    { textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'18px', zIndex:1, padding:'40px' },
  suits:      { display:'flex', gap:'36px', marginBottom:'8px' },
  suit:       { fontSize:'2.6rem', color:'var(--gold)', animation:'suitFloat 3s ease infinite', textShadow:'0 0 30px rgba(212,175,55,0.3)' },
  title:      { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'clamp(4rem,10vw,9rem)', letterSpacing:'0.12em', lineHeight:1, background:'linear-gradient(135deg,#f0d060 0%,#d4af37 40%,#a07820 70%,#d4af37 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundSize:'200% auto', animation:'shimmer 4s linear infinite', textShadow:'none' },
  divider:    { display:'flex', alignItems:'center', gap:'20px', width:'min(500px,80vw)' },
  divLine:    { flex:1, height:'1px', background:'linear-gradient(to right,transparent,rgba(212,175,55,0.5),transparent)' },
  divDiamond: { color:'var(--gold)', fontSize:'1rem', opacity:0.6 },
  sub:        { fontFamily:'var(--font-body)', fontSize:'clamp(1.1rem,3vw,2rem)', color:'var(--text)', fontStyle:'italic', letterSpacing:'0.04em', opacity:0.9 },
  edition:    { fontFamily:'var(--font-mono)', fontSize:'clamp(0.58rem,1.3vw,0.82rem)', color:'var(--text-muted)', letterSpacing:'0.18em', textTransform:'uppercase' },
  status:     { display:'flex', alignItems:'center', gap:'10px', marginTop:'8px', transition:'opacity 0.5s ease' },
  statusDot:  { width:'10px', height:'10px', borderRadius:'50%', boxShadow:'0 0 10px currentColor' },
  statusText: { fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--text-muted)', letterSpacing:'0.2em' },
};

// ── Leaderboard styles ────────────────────────────────────────────────────────
const L = {
  loadPage:   { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'24px', background:'#020608' },
  loadTitle:  { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'3rem', color:'var(--gold)', letterSpacing:'0.15em', textShadow:'0 0 40px rgba(212,175,55,0.4)' },
  loadDot:    { width:'8px', height:'8px', borderRadius:'50%', background:'var(--gold)', animation:'winnerPulse 1s ease infinite' },
  page:       { minHeight:'100vh', display:'flex', flexDirection:'column', background:'radial-gradient(ellipse at top,#071510 0%,#020608 65%)', overflow:'hidden' },
  topBar:     { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 36px', borderBottom:'1px solid rgba(212,175,55,0.14)', background:'rgba(4,12,8,0.98)', flexShrink:0 },
  topLeft:    { display:'flex', alignItems:'center', gap:'14px' },
  suit:       { color:'var(--gold)', fontSize:'1.1rem', opacity:0.5 },
  topTitle:   { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1.7rem', color:'var(--gold)', letterSpacing:'0.14em', textShadow:'0 0 30px rgba(212,175,55,0.4)' },
  topCenter:  { position:'absolute', left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' },
  topSub:     { fontFamily:'var(--font-mono)', fontSize:'0.68rem', letterSpacing:'0.24em', color:'var(--text-muted)', textTransform:'uppercase' },
  roundIndicator:{ display:'flex', alignItems:'center', gap:'8px' },
  roundDot:   { width:'10px', height:'10px', borderRadius:'50%', transition:'all 0.4s ease' },
  roundLabel: { fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--gold)', letterSpacing:'0.1em' },
  topRight:   { display:'flex', alignItems:'center', gap:'18px' },
  timerBlock: { display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' },
  timerVal:   { fontFamily:'var(--font-mono)', fontWeight:600, fontSize:'1.35rem', color:'var(--gold)', lineHeight:1, letterSpacing:'0.05em' },
  timerLbl:   { fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'var(--text-muted)', letterSpacing:'0.2em' },
  phasePill:  { padding:'5px 13px', borderRadius:'20px', border:'1px solid', fontFamily:'var(--font-mono)', fontSize:'0.63rem', letterSpacing:'0.14em', fontWeight:600 },
  audioCtrl:  { display:'flex', alignItems:'center', gap:'8px' },
  audioBtn:   { width:'34px', height:'34px', borderRadius:'8px', border:'1px solid', background:'transparent', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' },
  volumeSlider:{ width:'70px', accentColor:'var(--gold)', cursor:'pointer' },
  hdRow:      { display:'flex', alignItems:'center', gap:'12px', padding:'0 36px', background:'rgba(4,12,8,0.5)', flexShrink:0 },
  hdLine:     { flex:1, height:'1px', background:'linear-gradient(to right,transparent,rgba(212,175,55,0.2),transparent)' },
  hdDiamond:  { color:'var(--gold)', fontSize:'0.6rem', opacity:0.5 },
  hackBanner: { display:'flex', alignItems:'center', justifyContent:'center', gap:'16px', padding:'10px 36px', background:'linear-gradient(135deg,rgba(244,114,182,0.12),rgba(251,191,36,0.08))', borderBottom:'1px solid rgba(244,114,182,0.3)', animation:'hackAlert 2s ease infinite', flexShrink:0 },
  hackBannerIcon: { fontSize:'1.2rem' },
  hackBannerText: { fontFamily:'var(--font-mono)', fontSize:'0.8rem', color:'#f472b6', letterSpacing:'0.08em', fontWeight:600 },
  main:       { flex:1, padding:'20px 36px', overflow:'auto' },
  waiting:    { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px', height:'60vh' },
  waitSuits:  { fontSize:'3rem', color:'var(--gold)', letterSpacing:'0.4em', opacity:0.3 },
  waitText:   { fontFamily:'var(--font-display)', fontSize:'1.5rem', color:'var(--text-dim)', fontStyle:'italic' },
  table:      { display:'flex', flexDirection:'column', gap:'7px' },
  thead:      { display:'grid', gridTemplateColumns:'80px 1fr 180px 200px 100px 110px 130px', gap:'12px', padding:'6px 20px', alignItems:'center' },
  th:         { fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-muted)', letterSpacing:'0.2em', textTransform:'uppercase' },
  row:        { display:'grid', gridTemplateColumns:'80px 1fr 180px 200px 100px 110px 130px', gap:'12px', padding:'14px 20px', alignItems:'center', border:'1px solid', borderRadius:'12px', transition:'all 0.4s ease' },
  tdRank:     { display:'flex', alignItems:'center', justifyContent:'center' },
  rankNum:    { fontFamily:'var(--font-display)', fontWeight:900, lineHeight:1, transition:'all 0.3s ease' },
  tdTeam:     { display:'flex', alignItems:'center', gap:'12px' },
  colorBar:   { width:'4px', height:'40px', borderRadius:'2px', flexShrink:0 },
  teamName:   { fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.25rem', letterSpacing:'0.02em', transition:'color 0.3s ease' },
  frozenBadge:{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'#38bdf8', marginTop:'2px', letterSpacing:'0.06em' },
  tdLines:    { display:'flex', alignItems:'center', gap:'10px' },
  lineDots:   { display:'flex', gap:'5px', alignItems:'center' },
  lineDot:    { width:'11px', height:'11px', borderRadius:'50%', transition:'all 0.4s ease', flexShrink:0 },
  linesNum:   { fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.25rem', lineHeight:1, minWidth:'34px' },
  tdRoundScores:{ display:'flex', gap:'5px', alignItems:'center', justifyContent:'center' },
  rsPill:     { display:'flex', flexDirection:'column', alignItems:'center', gap:'1px', padding:'4px 8px', background:'rgba(212,175,55,0.07)', border:'1px solid rgba(212,175,55,0.15)', borderRadius:'6px', transition:'opacity 0.3s' },
  rsPillL:    { fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'var(--text-muted)' },
  rsPillV:    { fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.9rem', color:'var(--gold)' },
  tdTotal:    { textAlign:'center' },
  totalNum:   { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1.6rem', lineHeight:1, textShadow:'0 0 20px currentColor' },
  tdTime:     { textAlign:'center' },
  timeVal:    { fontFamily:'var(--font-mono)', fontSize:'1rem', color:'var(--text-dim)', letterSpacing:'0.04em' },
  tdStatus:   { display:'flex', justifyContent:'center' },
  chip:       { padding:'5px 13px', borderRadius:'20px', border:'1px solid', fontFamily:'var(--font-mono)', fontSize:'0.65rem', letterSpacing:'0.1em', fontWeight:600, whiteSpace:'nowrap' },
};
