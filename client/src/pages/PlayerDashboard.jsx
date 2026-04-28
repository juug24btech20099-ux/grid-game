import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import BingoGrid from '../components/BingoGrid.jsx';
import QuestionPanel from '../components/QuestionPanel.jsx';
import Timer from '../components/Timer.jsx';
import socket from '../socket.js';
import { playEffect, resumeCtx } from '../audio/CasinoAudio.js';

export default function PlayerDashboard() {
  const navigate = useNavigate();
  const { gameState, connected } = useGame('player');

  const [teamId]   = useState(() => localStorage.getItem('gg-team-id'));
  const [teamName] = useState(() => localStorage.getItem('gg-team-name') || 'Unknown');
  const [question, setQuestion]         = useState(null);
  const [lastResult, setLastResult]     = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [showWin, setShowWin]           = useState(false);
  const [showHack, setShowHack]         = useState(false);
  const [hackAnswer, setHackAnswer]     = useState(null);
  const [hackResult, setHackResult]     = useState(null);
  const [audioStarted, setAudioStarted] = useState(false);
  const prevPhase = useRef(null);
  const prevRound = useRef(null);

  useEffect(() => { if (!teamId) navigate('/'); }, [teamId]);

  const ensureAudio = () => {
    if (!audioStarted) { resumeCtx(); setAudioStarted(true); }
  };

  // Get question on round start / re-join
  useEffect(() => {
    const phase = gameState?.phase;
    const round = gameState?.currentRound;
    if (phase === 'round_active' && teamId) {
      if (prevPhase.current !== 'round_active' || prevRound.current !== round) {
        socket.emit('player:getQuestion', { teamId });
        setShowWin(false);
        setLastResult(null);
      }
    }
    prevPhase.current = phase;
    prevRound.current = round;
  }, [gameState?.phase, gameState?.currentRound, teamId]);

  // Hack modal
  useEffect(() => {
    if (gameState?.globalHack?.active) {
      setShowHack(true);
      setHackAnswer(null);
      setHackResult(null);
      playEffect('hack');
    } else {
      setShowHack(false);
    }
  }, [gameState?.globalHack?.id, gameState?.globalHack?.active]);

  // Socket listeners
  useEffect(() => {
    const onQuestion = (q) => { setQuestion(q); setLastResult(null); setSubmitting(false); };
    const onResult   = (r) => {
      setSubmitting(false);
      if (r.accepted) {
        setLastResult(r);
        if (r.correct) playEffect('correct');
        else playEffect('wrong');
        if (r.linesCompleted >= 5) { setShowWin(true); playEffect('winner'); }
      }
    };
    const onHackResult = (r) => {
      setHackResult(r);
      if (r.correct) playEffect('correct');
    };
    socket.on('question:data', onQuestion);
    socket.on('answer:result',  onResult);
    socket.on('hack:result',    onHackResult);
    return () => {
      socket.off('question:data', onQuestion);
      socket.off('answer:result',  onResult);
      socket.off('hack:result',    onHackResult);
    };
  }, []);

  const handleSubmit = useCallback((idx) => {
    if (!question || submitting) return;
    setSubmitting(true);
    socket.emit('player:submitAnswer', { teamId, questionId: question.id, selectedIndex: idx });
  }, [question, submitting, teamId]);

  const handleHackSubmit = () => {
    if (hackAnswer === null || !gameState?.globalHack) return;
    socket.emit('player:submitHack', { teamId, hackId: gameState.globalHack.id, selectedIndex: hackAnswer });
  };

  const handleUsePowerup = (type, targetId) => {
    socket.emit('player:usePowerup', { teamId, type, targetTeamId: targetId });
    playEffect('freeze');
  };

  const team        = gameState?.teams?.find(t => t.id === teamId);
  const phase       = gameState?.phase  || 'setup';
  const round       = gameState?.currentRound || 0;
  const totalRounds = gameState?.totalRounds  || 2;
  const isFrozen    = team?.isFrozen || false;
  const otherTeams  = (gameState?.teams || []).filter(t => t.id !== teamId);

  if (!teamId) return null;

  return (
    <div style={S.page} onClick={ensureAudio}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={S.hLeft}>
          <span style={S.hLogo}>GRID GAMBIT</span>
          <span style={S.hSuit}>♠</span>
        </div>

        <div style={S.hCenter}>
          <div style={{ ...S.teamBadge, borderColor: team?.color || 'var(--gold)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: team?.color || 'var(--gold)', flexShrink:0 }} />
            <span style={S.teamBadgeName}>{teamName}</span>
          </div>
        </div>

        <div style={S.hRight}>
          {round > 0 && (
            <div style={S.roundPill}>
              <span style={S.roundPillLabel}>ROUND</span>
              <span style={S.roundPillNum}>{round}/{totalRounds}</span>
            </div>
          )}
          <Stat val={`${team?.linesCompleted || 0}/5`}   label="LINES"  />
          <Stat val={team?.tokens ?? 30}                  label="TOKENS" color={(team?.tokens ?? 30) <= 3 ? '#ef4444' : 'var(--gold)'} />
          <Stat val={team?.totalScore || 0}               label="SCORE"  />
          <Timer seconds={team?.elapsedSeconds || 0} label="TIME" />
          <div style={{ width:7, height:7, borderRadius:'50%', background: connected ? '#22c55e' : '#ef4444', boxShadow:'0 0 7px currentColor' }} />
        </div>
      </header>

      {/* ── Phase banners ──────────────────────────────────────────────────── */}
      {phase === 'setup' && (
        <div style={S.banner}>⏳ Waiting for host to start the game…</div>
      )}
      {phase === 'round_end' && (
        <div style={{ ...S.banner, background:'rgba(212,175,55,0.1)', borderColor:'rgba(212,175,55,0.35)', color:'var(--gold)' }}>
          Round {round} complete! Waiting for the host to start the next round…
        </div>
      )}
      {phase === 'finished' && (
        <div style={{ ...S.banner, background:'rgba(212,175,55,0.12)', borderColor:'rgba(212,175,55,0.45)', color:'var(--gold)' }}>
          🏆 Game over! Check the leaderboard for final standings.
        </div>
      )}

      {/* ── No-tokens warning ─────────────────────────────────────────────── */}
      {phase === 'round_active' && (team?.tokens ?? 30) === 0 && (
        <div style={{ ...S.banner, background:'rgba(239,68,68,0.1)', borderColor:'rgba(239,68,68,0.35)', color:'#ef4444' }}>
          🪙 No tokens left this round! Wait for the next round or solve a Global Hack event.
        </div>
      )}

      {/* ── Power-up bar ──────────────────────────────────────────────────── */}
      {(team?.powerups?.length > 0) && (
        <div style={S.puBar}>
          <span style={S.puLabel}>POWER-UPS:</span>
          {(team.powerups || []).map((pu, i) => (
            <div key={i} style={S.puGroup}>
              <span style={S.puName}>❄️ FREEZE</span>
              <span style={{ color:'var(--text-muted)', fontSize:'0.7rem' }}>→</span>
              <select style={S.puSelect} onChange={e => { if (e.target.value) { handleUsePowerup('freeze', e.target.value); e.target.value = ''; } }} defaultValue="">
                <option value="">Target team…</option>
                {otherTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* ── Main 70/30 split ──────────────────────────────────────────────── */}
      <main style={S.main}>

        {/* 70% — question */}
        <section style={S.qSection}>
          <div style={S.secHdr}>
            <span style={S.secLabel}>CHALLENGE</span>
            {question && <span style={S.secMeta}>#{(team?.currentQuestionIndex || 0) + 1} of {(team?.questionDeck?.length || 25)} · Round {round}</span>}
          </div>
          <div style={S.qContent}>
            <QuestionPanel
              question={question}
              onSubmit={handleSubmit}
              lastResult={lastResult}
              disabled={submitting || phase !== 'round_active' || (team?.tokens ?? 30) === 0}
              tokens={team?.tokens ?? 30}
              isFrozen={isFrozen}
              frozenUntil={team?.frozenUntil}
            />
          </div>
        </section>

        <div style={S.splitLine} />

        {/* 30% — grid. Key constraint: this column must NOT stretch vertically beyond its content */}
        <section style={S.gridSection}>
          <div style={S.secHdr}>
            <span style={S.secLabel}>YOUR GRID</span>
            {gameState?.roundWinners?.[round]?.includes(teamId) && (
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--gold)', animation:'winnerPulse 1.5s ease infinite' }}>ROUND WINNER 🏆</span>
            )}
          </div>

          {/* Grid wrapper: fixed width, let BingoGrid measure itself */}
          <div style={S.gridWrapper}>
            <BingoGrid
              board={team?.board || []}
              markedCells={team?.markedCells || []}
              lines={team?.lines || []}
              teamColor={team?.color || '#d4af37'}
              isFrozen={isFrozen}
            />
          </div>

          {/* Round score pills */}
          {(team?.roundScores?.length > 0) && (
            <div style={S.rsPills}>
              {team.roundScores.map((pts, i) => (
                <div key={i} style={S.rsPill}>
                  <span style={S.rsPillL}>R{i + 1}</span>
                  <span style={S.rsPillV}>{pts}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Global Hack Modal ─────────────────────────────────────────────── */}
      {showHack && gameState?.globalHack && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowHack(false)}>
          <div style={S.hackCard}>
            <div style={S.hackHdr}>
              <span style={{ fontSize:'1.8rem' }}>⚡</span>
              <span style={S.hackTitle}>GLOBAL HACK EVENT</span>
              <span style={{ fontSize:'1.8rem' }}>⚡</span>
            </div>
            <p style={S.hackSub}>First 3 teams to solve get +2 tokens!</p>
            <p style={S.hackQ}>{gameState.globalHack.prompt}</p>
            <div style={S.hackOpts}>
              {gameState.globalHack.options.map((opt, i) => (
                <button key={i} onClick={() => setHackAnswer(i)}
                  style={{ ...S.hackOpt, ...(hackAnswer === i ? { borderColor:'var(--gold)', background:'rgba(212,175,55,0.12)' } : {}) }}>
                  <span style={{ ...S.hackOptLbl, background: hackAnswer === i ? 'var(--gold)' : 'rgba(212,175,55,0.1)', color: hackAnswer === i ? '#000' : 'var(--gold)' }}>
                    {['A','B','C','D'][i]}
                  </span>
                  <span style={{ fontFamily:'var(--font-body)', fontSize:'0.96rem', color:'var(--text)' }}>{opt}</span>
                </button>
              ))}
            </div>
            {hackResult ? (
              <div style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontSize:'0.88rem', padding:'12px', color: hackResult.correct ? '#22c55e' : '#ef4444' }}>
                {hackResult.correct ? `✓ Correct! +2 tokens added.` : '✗ Wrong answer. Better luck next hack!'}
              </div>
            ) : (
              <button onClick={handleHackSubmit} disabled={hackAnswer === null}
                style={{ ...S.hackSubmit, ...(hackAnswer !== null ? S.hackSubmitActive : {}) }}>
                Submit Hack Answer
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Bingo Win Overlay ─────────────────────────────────────────────── */}
      {showWin && (
        <div style={S.overlay} onClick={() => setShowWin(false)}>
          <div style={S.winCard}>
            <div style={{ fontSize:'2rem', color:'var(--gold)', letterSpacing:'0.3em', marginBottom:'18px', opacity:0.7 }}>♠ ♦ ♣ ♥</div>
            <h2 style={S.winTitle}>BINGO!</h2>
            <p style={S.winSub}>5 lines complete — Round {round} winner!</p>
            <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)', marginTop:'20px', letterSpacing:'0.1em' }}>
              Click anywhere to continue
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ val, label, color = 'var(--gold)' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1px' }}>
      <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, fontSize:'0.92rem', color, lineHeight:1 }}>{val}</span>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.5rem', color:'var(--text-muted)', letterSpacing:'0.14em' }}>{label}</span>
    </div>
  );
}

const S = {
  page:          { height:'100vh', display:'flex', flexDirection:'column', background:'radial-gradient(ellipse at top,#071510 0%,#020608 60%)', overflow:'hidden' },

  header:        { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 20px', borderBottom:'1px solid var(--border)', background:'rgba(4,12,8,0.98)', backdropFilter:'blur(20px)', flexShrink:0, position:'relative', zIndex:10 },
  hLeft:         { display:'flex', alignItems:'center', gap:'8px' },
  hLogo:         { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1rem', color:'var(--gold)', letterSpacing:'0.12em', textShadow:'0 0 20px rgba(212,175,55,0.3)' },
  hSuit:         { color:'var(--gold)', opacity:0.4, fontSize:'0.85rem' },
  hCenter:       { position:'absolute', left:'50%', transform:'translateX(-50%)' },
  teamBadge:     { display:'flex', alignItems:'center', gap:'7px', padding:'5px 13px', borderRadius:'20px', border:'1px solid', background:'rgba(10,24,18,0.8)' },
  teamBadgeName: { fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.88rem', color:'var(--text)' },
  hRight:        { display:'flex', alignItems:'center', gap:'14px' },
  roundPill:     { display:'flex', flexDirection:'column', alignItems:'center', gap:'1px', padding:'4px 9px', background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.3)', borderRadius:'7px' },
  roundPillLabel:{ fontFamily:'var(--font-mono)', fontSize:'0.48rem', color:'var(--text-muted)', letterSpacing:'0.15em' },
  roundPillNum:  { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'0.9rem', color:'var(--gold)', lineHeight:1 },

  banner:        { padding:'8px 20px', background:'rgba(10,24,18,0.6)', borderBottom:'1px solid rgba(212,175,55,0.12)', textAlign:'center', flexShrink:0, fontFamily:'var(--font-mono)', fontSize:'0.73rem', color:'var(--text-dim)', letterSpacing:'0.06em' },

  puBar:         { display:'flex', alignItems:'center', gap:'10px', padding:'7px 20px', background:'rgba(212,175,55,0.05)', borderBottom:'1px solid rgba(212,175,55,0.08)', flexShrink:0, flexWrap:'wrap' },
  puLabel:       { fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--gold)', letterSpacing:'0.15em', opacity:0.8 },
  puGroup:       { display:'flex', alignItems:'center', gap:'7px' },
  puName:        { fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'#38bdf8', letterSpacing:'0.06em' },
  puSelect:      { background:'rgba(10,24,18,0.9)', border:'1px solid rgba(212,175,55,0.22)', borderRadius:'5px', color:'var(--text)', fontFamily:'var(--font-mono)', fontSize:'0.7rem', padding:'3px 7px', cursor:'pointer', outline:'none' },

  // KEY FIX: main uses flex row, both sections have explicit flex sizing
  // gridSection does NOT stretch — it uses alignSelf:'flex-start' + sticky
  main:          { flex:1, display:'flex', overflow:'hidden', minHeight:0 },

  qSection:      { flex:'0 0 68%', display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid var(--border)', minWidth:0 },
  splitLine:     { width:'1px', flexShrink:0, background:'linear-gradient(to bottom,transparent,var(--border),transparent)' },
  gridSection:   { flex:'0 0 32%', display:'flex', flexDirection:'column', padding:'14px 16px', overflow:'auto', minWidth:0, gap:'10px' },

  secHdr:        { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px 10px', borderBottom:'1px solid rgba(212,175,55,0.08)', flexShrink:0 },
  secLabel:      { fontFamily:'var(--font-mono)', fontSize:'0.6rem', letterSpacing:'0.2em', color:'var(--gold)', opacity:0.7 },
  secMeta:       { fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)' },

  qContent:      { flex:1, overflow:'auto', padding:'14px 20px' },

  // Grid wrapper: full width of column, no height constraint
  gridWrapper:   { width:'100%' },

  rsPills:       { display:'flex', gap:'6px', justifyContent:'center', flexWrap:'wrap' },
  rsPill:        { display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', padding:'5px 10px', background:'rgba(212,175,55,0.06)', border:'1px solid rgba(212,175,55,0.14)', borderRadius:'7px' },
  rsPillL:       { fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'var(--text-muted)', letterSpacing:'0.1em' },
  rsPillV:       { fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.9rem', color:'var(--gold)' },

  overlay:       { position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, animation:'fadeIn 0.3s ease' },

  hackCard:      { background:'linear-gradient(135deg,#061812,#0a2018)', border:'2px solid var(--gold)', borderRadius:'20px', padding:'34px 42px', maxWidth:'540px', width:'90%', boxShadow:'0 0 80px rgba(212,175,55,0.25)', animation:'spinIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' },
  hackHdr:       { display:'flex', alignItems:'center', justifyContent:'center', gap:'14px', marginBottom:'8px' },
  hackTitle:     { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1.5rem', color:'var(--gold)', letterSpacing:'0.1em' },
  hackSub:       { fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-dim)', textAlign:'center', letterSpacing:'0.06em', marginBottom:'18px' },
  hackQ:         { fontFamily:'var(--font-display)', fontWeight:600, fontSize:'1.05rem', color:'var(--text)', lineHeight:1.5, marginBottom:'16px' },
  hackOpts:      { display:'flex', flexDirection:'column', gap:'7px', marginBottom:'16px' },
  hackOpt:       { display:'flex', alignItems:'center', gap:'11px', padding:'10px 13px', background:'rgba(10,24,18,0.9)', border:'1px solid rgba(212,175,55,0.14)', borderRadius:'8px', cursor:'pointer', transition:'all 0.18s ease', width:'100%' },
  hackOptLbl:    { width:'25px', height:'25px', borderRadius:'5px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.75rem', flexShrink:0, transition:'all 0.18s ease' },
  hackSubmit:    { width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid rgba(212,175,55,0.18)', background:'rgba(212,175,55,0.04)', color:'var(--text-muted)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.95rem', letterSpacing:'0.08em', cursor:'not-allowed', transition:'all 0.22s ease' },
  hackSubmitActive:{ background:'linear-gradient(135deg,#d4af37,#a07820)', color:'#000', border:'1px solid #d4af37', cursor:'pointer', boxShadow:'0 4px 20px rgba(212,175,55,0.3)' },

  winCard:       { background:'linear-gradient(135deg,#061812,#0a2018)', border:'2px solid var(--gold)', borderRadius:'24px', padding:'56px 76px', textAlign:'center', boxShadow:'0 0 80px rgba(212,175,55,0.3)', animation:'spinIn 0.6s cubic-bezier(0.34,1.56,0.64,1)', cursor:'pointer' },
  winTitle:      { fontFamily:'var(--font-display)', fontWeight:900, fontSize:'5rem', color:'var(--gold)', letterSpacing:'0.15em', textShadow:'0 0 60px rgba(212,175,55,0.6)', lineHeight:1 },
  winSub:        { fontFamily:'var(--font-body)', fontSize:'1.25rem', color:'var(--text)', marginTop:'14px', fontStyle:'italic' },
};
