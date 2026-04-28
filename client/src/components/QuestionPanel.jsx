import React, { useState, useEffect, useRef } from 'react';

const CAT_COLORS = {
  'AI-DevOps':    '#60a5fa',
  'Cyber Smart':  '#f472b6',
  'Scenario':     '#34d399',
  'Slice of Life':'#fbbf24',
  'CPS':          '#a78bfa',
  'CSE':          '#f97316',
};

const LABELS = ['A', 'B', 'C', 'D'];

// ── Terminal log renderer ─────────────────────────────────────────────────────
function TerminalLog({ lines = [], prompt = '$' }) {
  const [visible, setVisible] = useState(0);
  const endRef = useRef(null);

  useEffect(() => {
    setVisible(0);
    const iv = setInterval(() => setVisible(v => {
      if (v >= lines.length) { clearInterval(iv); return v; }
      return v + 1;
    }), 60);
    return () => clearInterval(iv);
  }, [lines]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [visible]);

  return (
    <div style={TL.box}>
      <div style={TL.titleBar}>
        <div style={TL.dots}><span style={TL.dot1}/><span style={TL.dot2}/><span style={TL.dot3}/></div>
        <span style={TL.title}>terminal — bash</span>
      </div>
      <div style={TL.body}>
        {lines.slice(0, visible).map((line, i) => {
          const isCmd   = line.startsWith('$');
          const isErr   = line.startsWith('[ERROR]') || line.includes('FAILED') || line.includes('Error');
          const isWarn  = line.startsWith('[WARN]')  || line.includes('WARNING');
          const isOk    = line.startsWith('[OK]')    || line.includes('SUCCESS') || line.startsWith('✓');
          const isInfo  = line.startsWith('[INFO]')  || line.startsWith('--');
          return (
            <div key={i} style={{ ...TL.line,
              color: isCmd ? '#22c55e' : isErr ? '#f87171' : isWarn ? '#fbbf24' : isOk ? '#34d399' : isInfo ? '#60a5fa' : '#e2e8d0',
              fontWeight: isCmd ? 600 : 400,
            }}>
              {isCmd && <span style={{ color:'#d4af37', marginRight:'6px' }}>{prompt}</span>}
              {line.replace(/^\$\s?/, '')}
              {i === visible - 1 && <span style={TL.cursor}>▊</span>}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}

const TL = {
  box:     { background:'#0a0f0a', borderRadius:'10px', overflow:'hidden', border:'1px solid rgba(34,197,94,0.25)', marginBottom:'12px', boxShadow:'0 0 20px rgba(34,197,94,0.08)' },
  titleBar:{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 12px', background:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.06)' },
  dots:    { display:'flex', gap:'5px' },
  dot1:    { width:'10px', height:'10px', borderRadius:'50%', background:'#ef4444', display:'block' },
  dot2:    { width:'10px', height:'10px', borderRadius:'50%', background:'#f59e0b', display:'block' },
  dot3:    { width:'10px', height:'10px', borderRadius:'50%', background:'#22c55e', display:'block' },
  title:   { fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'rgba(255,255,255,0.4)', letterSpacing:'0.05em', margin:'0 auto' },
  body:    { padding:'12px 14px', maxHeight:'200px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'2px' },
  line:    { fontFamily:'var(--font-mono)', fontSize:'0.75rem', lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-all' },
  cursor:  { display:'inline-block', animation:'winnerPulse 0.8s ease infinite', marginLeft:'2px', color:'#22c55e' },
};

// ── ASCII circuit renderer ────────────────────────────────────────────────────
function CircuitBoard({ diagram = [], faultLine = -1 }) {
  return (
    <div style={CB.box}>
      <div style={CB.titleBar}>
        <span style={CB.chip}>⚡</span>
        <span style={CB.title}>Circuit Simulator v3.1</span>
        <span style={{ ...CB.status, color: faultLine >= 0 ? '#ef4444' : '#22c55e' }}>
          {faultLine >= 0 ? '● FAULT DETECTED' : '● NOMINAL'}
        </span>
      </div>
      <div style={CB.body}>
        {diagram.map((line, i) => (
          <div key={i} style={{ ...CB.line,
            background: i === faultLine ? 'rgba(239,68,68,0.12)' : 'transparent',
            borderLeft: i === faultLine ? '2px solid #ef4444' : '2px solid transparent',
            color: i === faultLine ? '#fca5a5' : line.includes('VCC') || line.includes('+5V') ? '#34d399' : line.includes('GND') ? '#60a5fa' : line.includes('??') ? '#f87171' : '#c8d8c8',
          }}>
            <span style={CB.lineNum}>{String(i+1).padStart(2,'0')}</span>
            {line}
            {i === faultLine && <span style={CB.fault}> ← FAULT</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const CB = {
  box:     { background:'#060d0a', borderRadius:'10px', overflow:'hidden', border:'1px solid rgba(167,139,250,0.3)', marginBottom:'12px', boxShadow:'0 0 20px rgba(167,139,250,0.08)' },
  titleBar:{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 14px', background:'rgba(167,139,250,0.08)', borderBottom:'1px solid rgba(167,139,250,0.15)' },
  chip:    { fontSize:'1rem' },
  title:   { fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'#a78bfa', letterSpacing:'0.1em', fontWeight:600 },
  status:  { fontFamily:'var(--font-mono)', fontSize:'0.65rem', letterSpacing:'0.1em', marginLeft:'auto' },
  body:    { padding:'8px 0', fontFamily:'var(--font-mono)', fontSize:'0.72rem' },
  line:    { padding:'2px 14px', lineHeight:1.6, display:'flex', gap:'12px', alignItems:'center', transition:'background 0.2s' },
  lineNum: { color:'rgba(255,255,255,0.2)', minWidth:'20px', userSelect:'none', fontSize:'0.62rem' },
  fault:   { color:'#ef4444', fontWeight:700, fontSize:'0.65rem', letterSpacing:'0.1em', animation:'winnerPulse 1s ease infinite' },
};

// ── Packet sniffer renderer ───────────────────────────────────────────────────
function PacketSniffer({ packets = [] }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    setVisible(0);
    const iv = setInterval(() => setVisible(v => { if (v >= packets.length) { clearInterval(iv); return v; } return v + 1; }), 120);
    return () => clearInterval(iv);
  }, [packets]);

  return (
    <div style={PS.box}>
      <div style={PS.titleBar}>
        <span style={PS.title}>📡  Packet Sniffer — Serial Monitor</span>
        <span style={{ ...PS.badge, animation:'winnerPulse 1s ease infinite' }}>● LIVE</span>
      </div>
      <div style={PS.body}>
        <div style={PS.header}>
          <span style={PS.col1}>TIME</span>
          <span style={PS.col2}>ADDR</span>
          <span style={PS.col3}>DATA</span>
          <span style={PS.col4}>CLK</span>
          <span style={PS.col5}>FLAG</span>
        </div>
        {packets.slice(0, visible).map((p, i) => (
          <div key={i} style={{ ...PS.row, background: p.anomaly ? 'rgba(239,68,68,0.08)' : i%2===0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
            <span style={PS.col1}>{p.time}</span>
            <span style={{ ...PS.col2, color:'#60a5fa' }}>0x{p.addr}</span>
            <span style={{ ...PS.col3, color: p.anomaly ? '#f87171' : '#c8d8c8' }}>{p.data}</span>
            <span style={{ ...PS.col4, color:'#fbbf24' }}>{p.clk}</span>
            <span style={{ ...PS.col5, color: p.anomaly ? '#ef4444' : '#34d399' }}>{p.flag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PS = {
  box:     { background:'#050a08', borderRadius:'10px', overflow:'hidden', border:'1px solid rgba(96,165,250,0.25)', marginBottom:'12px' },
  titleBar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', background:'rgba(96,165,250,0.06)', borderBottom:'1px solid rgba(96,165,250,0.12)' },
  title:   { fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'#60a5fa', letterSpacing:'0.06em' },
  badge:   { fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'#22c55e', letterSpacing:'0.1em' },
  body:    { padding:'0', maxHeight:'180px', overflowY:'auto' },
  header:  { display:'grid', gridTemplateColumns:'60px 60px 1fr 60px 60px', gap:'8px', padding:'5px 14px', background:'rgba(255,255,255,0.04)', fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em' },
  row:     { display:'grid', gridTemplateColumns:'60px 60px 1fr 60px 60px', gap:'8px', padding:'4px 14px', fontFamily:'var(--font-mono)', fontSize:'0.68rem', transition:'background 0.2s' },
  col1:    { color:'rgba(255,255,255,0.35)' },
  col2:    {}, col3:{}, col4:{}, col5:{},
};

// ── Logic gate visual ─────────────────────────────────────────────────────────
function LogicGate({ expression = '', inputs = {}, expected = '' }) {
  return (
    <div style={LG.box}>
      <div style={LG.titleBar}><span style={LG.title}>🔧  Logic Gate Analyzer</span></div>
      <div style={LG.body}>
        <div style={LG.inputRow}>
          {Object.entries(inputs).map(([k, v]) => (
            <div key={k} style={LG.inputPin}>
              <span style={LG.pinName}>{k}</span>
              <span style={{ ...LG.pinVal, background: v ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)', color: v ? '#22c55e' : '#ef4444', border:`1px solid ${v?'rgba(34,197,94,0.4)':'rgba(239,68,68,0.3)'}` }}>{v ? '1' : '0'}</span>
            </div>
          ))}
        </div>
        <div style={LG.expr}>
          <span style={LG.exprLabel}>Expression:</span>
          <code style={LG.exprCode}>{expression}</code>
        </div>
        <div style={LG.expected}>
          <span style={LG.exprLabel}>Expected Output:</span>
          <span style={{ ...LG.pinVal, background:'rgba(251,191,36,0.15)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.3)', marginLeft:'8px' }}>?</span>
        </div>
      </div>
    </div>
  );
}

const LG = {
  box:       { background:'#06080a', borderRadius:'10px', overflow:'hidden', border:'1px solid rgba(251,191,36,0.25)', marginBottom:'12px' },
  titleBar:  { padding:'8px 14px', background:'rgba(251,191,36,0.06)', borderBottom:'1px solid rgba(251,191,36,0.12)' },
  title:     { fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'#fbbf24', letterSpacing:'0.08em' },
  body:      { padding:'14px' },
  inputRow:  { display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'12px' },
  inputPin:  { display:'flex', flexDirection:'column', alignItems:'center', gap:'5px' },
  pinName:   { fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'rgba(255,255,255,0.5)', letterSpacing:'0.1em' },
  pinVal:    { padding:'4px 12px', borderRadius:'6px', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'1rem' },
  expr:      { display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' },
  exprLabel: { fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'rgba(255,255,255,0.4)', letterSpacing:'0.06em', whiteSpace:'nowrap' },
  exprCode:  { fontFamily:'var(--font-mono)', fontSize:'0.85rem', color:'#fbbf24', background:'rgba(251,191,36,0.08)', padding:'3px 10px', borderRadius:'5px', border:'1px solid rgba(251,191,36,0.2)' },
  expected:  { display:'flex', alignItems:'center', gap:'8px' },
};

// ── Code diff renderer ────────────────────────────────────────────────────────
function CodeDiff({ lines = [] }) {
  return (
    <div style={{ background:'#080c0a', borderRadius:'10px', overflow:'hidden', border:'1px solid rgba(52,211,153,0.2)', marginBottom:'12px' }}>
      <div style={{ padding:'7px 14px', background:'rgba(52,211,153,0.06)', borderBottom:'1px solid rgba(52,211,153,0.1)', fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'#34d399', letterSpacing:'0.1em' }}>
        📄  Code Review — Find the Bug
      </div>
      <div style={{ padding:'8px 0', maxHeight:'200px', overflowY:'auto' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display:'flex', gap:'10px', padding:'2px 14px', background: l.type==='bug'?'rgba(239,68,68,0.1)':l.type==='good'?'rgba(34,197,94,0.05)':'transparent', borderLeft:`3px solid ${l.type==='bug'?'#ef4444':l.type==='good'?'rgba(34,197,94,0.3)':'transparent'}` }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'rgba(255,255,255,0.2)', minWidth:'24px', userSelect:'none' }}>{i+1}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.73rem', color: l.type==='bug'?'#fca5a5':l.type==='comment'?'rgba(255,255,255,0.3)':'#c8d8c8', whiteSpace:'pre' }}>{l.code}</span>
            {l.type==='bug' && <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'#ef4444', marginLeft:'auto', whiteSpace:'nowrap', letterSpacing:'0.06em' }}>← bug</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main QuestionPanel ────────────────────────────────────────────────────────
export default function QuestionPanel({ question, onSubmit, lastResult, disabled, tokens = 30, isFrozen = false, frozenUntil = null }) {
  const [selected, setSelected]         = useState(null);
  const [freezeCountdown, setCountdown] = useState(0);

  useEffect(() => { setSelected(null); }, [question?.id]);

  useEffect(() => {
    if (!frozenUntil) return;
    const tick = () => setCountdown(Math.max(0, Math.ceil((frozenUntil - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [frozenUntil]);

  if (isFrozen) return (
    <div style={S.frozenScreen}>
      <div style={{ fontSize:'5rem', lineHeight:1 }}>❄️</div>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'3rem', color:'#38bdf8', letterSpacing:'0.15em', textShadow:'0 0 40px #38bdf8' }}>FROZEN</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.95rem', color:'#38bdf8', opacity:0.8 }}>Screen locked for {freezeCountdown}s</div>
      <div style={{ fontFamily:'var(--font-body)', fontSize:'0.88rem', color:'var(--text-muted)', textAlign:'center' }}>A rival team used a FREEZE power-up on you.</div>
    </div>
  );

  if (!question) return (
    <div style={S.waiting}>
      <div style={{ fontSize:'3.5rem' }}>🎰</div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', color:'var(--gold)', textAlign:'center' }}>Waiting for game to start...</div>
      <div style={{ fontFamily:'var(--font-body)', fontSize:'0.95rem', color:'var(--text-dim)', textAlign:'center' }}>The host will begin the session shortly.</div>
    </div>
  );

  const catColor  = CAT_COLORS[question.category] || '#d4af37';
  const tokenCost = question.boss ? 2 : 1;
  const canSubmit = selected !== null && !disabled && !isFrozen && tokens >= tokenCost;
  const meta      = question.meta || {};

  return (
    <div style={S.wrapper}>
      {/* Top row */}
      <div style={S.topRow}>
        <span style={{ ...S.catBadge, background:`${catColor}18`, color:catColor, borderColor:`${catColor}40` }}>
          {question.category}
        </span>
        <div style={S.topRight}>
          {question.boss && <span style={S.bossBadge}>👑 BOSS</span>}
          <div style={S.tokenPill}>
            <span>🪙</span>
            <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.88rem', color: tokens <= 3 ? '#ef4444' : 'var(--gold)' }}>{tokens}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)' }}>(-{tokenCost})</span>
          </div>
        </div>
      </div>

      {/* Immersive content based on challenge type */}
      {meta.type === 'terminal' && <TerminalLog lines={meta.logs || []} />}
      {meta.type === 'circuit'  && <CircuitBoard diagram={meta.diagram || []} faultLine={meta.faultLine ?? -1} />}
      {meta.type === 'packet'   && <PacketSniffer packets={meta.packets || []} />}
      {meta.type === 'logic'    && <LogicGate expression={meta.expression} inputs={meta.inputs || {}} expected={meta.expected} />}
      {meta.type === 'code'     && <CodeDiff lines={meta.lines || []} />}

      {/* Question prompt */}
      <div style={{ ...S.prompt, ...(question.boss ? { color:'#fca5a5', textShadow:'0 0 30px rgba(239,68,68,0.2)' } : {}) }}>
        {question.prompt}
      </div>

      {/* Options */}
      <div style={S.options}>
        {question.options.map((opt, i) => {
          const isSel = selected === i;
          return (
            <button key={i} onClick={() => !disabled && setSelected(i)} disabled={disabled}
              style={{ ...S.option, ...(isSel ? { borderColor:catColor, background:`${catColor}12`, boxShadow:`0 0 14px ${catColor}15` } : {}) }}>
              <span style={{ ...S.optLabel, background: isSel ? catColor : 'rgba(212,175,55,0.1)', color: isSel ? '#000' : 'var(--gold)' }}>
                {LABELS[i]}
              </span>
              <code style={{ ...S.optText, fontFamily: opt.startsWith('$') || opt.startsWith('0x') || opt.match(/^\d+$/) ? 'var(--font-mono)' : 'var(--font-body)', fontSize: opt.startsWith('$') ? '0.82rem' : '0.96rem' }}>
                {opt}
              </code>
            </button>
          );
        })}
      </div>

      {/* Submit */}
      <button onClick={() => canSubmit && onSubmit(selected)} disabled={!canSubmit}
        style={{ ...S.submitBtn, ...(canSubmit ? S.submitActive : {}) }}>
        {disabled ? 'Processing...' : tokens < tokenCost ? `Need ${tokenCost} tokens` : `Confirm Answer  (−${tokenCost} token${tokenCost > 1 ? 's' : ''})`}
      </button>

      {/* Feedback */}
      {lastResult && (
        <div style={{ ...S.feedback, background: lastResult.correct ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)', borderColor: lastResult.correct ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.3)', color: lastResult.correct ? '#22c55e' : '#ef4444' }}>
          {lastResult.correct
            ? `✓ Correct! Cell marked — ${lastResult.linesCompleted}/5 lines · ${lastResult.tokens} tokens left`
            : `✗ Wrong answer · ${lastResult.tokens} tokens remaining`}
        </div>
      )}
    </div>
  );
}

const S = {
  wrapper:     { display:'flex', flexDirection:'column', gap:'12px', height:'100%', overflowY:'auto' },
  waiting:     { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'14px', height:'100%', padding:'40px 20px' },
  frozenScreen:{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'14px', height:'100%', padding:'40px 20px', background:'rgba(56,189,248,0.05)', borderRadius:'12px', border:'1px solid rgba(56,189,248,0.2)' },
  topRow:      { display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' },
  catBadge:    { fontFamily:'var(--font-mono)', fontSize:'0.66rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', padding:'4px 12px', borderRadius:'20px', border:'1px solid' },
  topRight:    { display:'flex', alignItems:'center', gap:'10px' },
  bossBadge:   { fontFamily:'var(--font-mono)', fontSize:'0.66rem', color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.35)', padding:'4px 10px', borderRadius:'20px', letterSpacing:'0.06em', animation:'bossGlow 2s ease infinite' },
  tokenPill:   { display:'flex', alignItems:'center', gap:'5px', padding:'4px 12px', background:'rgba(212,175,55,0.08)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'20px' },
  prompt:      { fontFamily:'var(--font-display)', fontSize:'1.05rem', fontWeight:600, color:'var(--text)', lineHeight:1.55, letterSpacing:'0.01em' },
  options:     { display:'flex', flexDirection:'column', gap:'6px' },
  option:      { display:'flex', alignItems:'center', gap:'12px', padding:'10px 13px', background:'rgba(10,24,18,0.9)', border:'1px solid rgba(212,175,55,0.14)', borderRadius:'8px', cursor:'pointer', transition:'all 0.18s ease', textAlign:'left', width:'100%' },
  optLabel:    { display:'flex', alignItems:'center', justifyContent:'center', width:'26px', height:'26px', borderRadius:'6px', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.76rem', flexShrink:0, transition:'all 0.18s ease' },
  optText:     { color:'var(--text)', lineHeight:1.3, flex:1, textAlign:'left' },
  submitBtn:   { padding:'12px', borderRadius:'8px', border:'1px solid rgba(212,175,55,0.18)', background:'rgba(212,175,55,0.04)', color:'var(--text-muted)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.95rem', letterSpacing:'0.08em', cursor:'not-allowed', transition:'all 0.22s ease', marginTop:'auto' },
  submitActive:{ background:'linear-gradient(135deg,#d4af37,#a07820)', color:'#000', border:'1px solid #d4af37', cursor:'pointer', boxShadow:'0 4px 20px rgba(212,175,55,0.3)' },
  feedback:    { padding:'10px 13px', borderRadius:'8px', border:'1px solid', fontFamily:'var(--font-mono)', fontSize:'0.78rem', letterSpacing:'0.03em', animation:'fadeIn 0.3s ease' },
};
