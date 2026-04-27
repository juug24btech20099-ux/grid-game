import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function BingoGrid({ board = [], markedCells = [], lines = [], teamColor = '#d4af37', isFrozen = false }) {
  const [newlyMarked, setNewlyMarked]   = useState(new Set());
  const [cellSize,    setCellSize]      = useState(0);
  const gridRef   = useRef(null);
  const prevMarked= useRef(new Set());

  const markedSet       = new Set(markedCells);
  const completedCells  = new Set(lines.flatMap(l => l.cells || []));

  // ── Force perfectly square cells by measuring container ──────────────────
  const measure = useCallback(() => {
    if (!gridRef.current) return;
    const w = gridRef.current.offsetWidth;
    // 5 cells + 4 gaps of 3px each
    setCellSize(Math.floor((w - 12) / 5));
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // ── Detect newly marked for animation ────────────────────────────────────
  useEffect(() => {
    const fresh = new Set();
    markedCells.forEach(c => { if (!prevMarked.current.has(c)) fresh.add(c); });
    if (fresh.size > 0) {
      setNewlyMarked(fresh);
      setTimeout(() => setNewlyMarked(new Set()), 900);
    }
    prevMarked.current = new Set(markedCells);
  }, [markedCells]);

  const cs = cellSize; // shorthand

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px', width:'100%', position:'relative', ...(isFrozen ? { filter:'hue-rotate(160deg) brightness(0.85)', pointerEvents:'none' } : {}) }}>

      {isFrozen && (
        <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(56,189,248,0.12)', borderRadius:'8px', border:'2px solid rgba(56,189,248,0.5)', backdropFilter:'blur(2px)' }}>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1.3rem', color:'#38bdf8', letterSpacing:'0.1em', textShadow:'0 0 20px #38bdf8' }}>❄️ FROZEN</span>
        </div>
      )}

      {/* Headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'3px' }}>
        {['G','R','I','D','!'].map((l, i) => (
          <div key={i} style={{ textAlign:'center', fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1rem', color: i === 4 ? teamColor : 'var(--gold)', letterSpacing:'0.1em', padding:'3px 0', textShadow:'0 0 16px rgba(212,175,55,0.5)' }}>{l}</div>
        ))}
      </div>

      {/* Grid — measured container, cells sized explicitly */}
      <div ref={gridRef} style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'3px', width:'100%' }}>
        {Array.from({ length: 25 }, (_, idx) => {
          const isMarked  = markedSet.has(idx);
          const isNew     = newlyMarked.has(idx);
          const isLine    = completedCells.has(idx);
          const isBoss    = idx === 12;
          const phrase    = board[idx] || '';

          return (
            <div key={idx} className={isNew ? 'cell-bounce' : ''} style={{
              position: 'relative',
              width:  cs > 0 ? cs : undefined,
              height: cs > 0 ? cs : undefined,
              aspectRatio: '1 / 1',    // fallback before first measure
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '5px',
              padding: '2px',
              overflow: 'hidden',
              transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
              background: isMarked ? 'rgba(4,10,6,0.97)' : isBoss ? 'rgba(20,8,8,0.95)' : 'rgba(10,24,18,0.9)',
              border: isLine
                ? `1px solid ${teamColor}`
                : isMarked
                ? '1px solid rgba(212,175,55,0.38)'
                : isBoss
                ? '1px solid rgba(239,68,68,0.4)'
                : '1px solid rgba(212,175,55,0.13)',
              boxShadow: isLine
                ? `0 0 14px ${teamColor}50, inset 0 0 20px ${teamColor}10`
                : isBoss && !isMarked
                ? '0 0 12px rgba(239,68,68,0.2)'
                : 'none',
              animation: isBoss && !isMarked ? 'bossGlow 2s ease infinite' : 'none',
            }}>

              {/* Boss crown */}
              {isBoss && !isMarked && (
                <div style={{ position:'absolute', top:2, right:3, fontSize:'0.5rem', opacity:0.7, zIndex:2, lineHeight:1 }}>👑</div>
              )}

              {/* SVG cross */}
              {isMarked && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}>
                  <svg viewBox="0 0 40 40" style={{ width:'70%', height:'70%' }}>
                    <line x1="7" y1="7" x2="33" y2="33"
                      stroke={isLine ? teamColor : '#d4af37'} strokeWidth="3.5" strokeLinecap="round"
                      style={{ strokeDasharray:38, strokeDashoffset: isNew ? 38 : 0, transition:'stroke-dashoffset 0.35s ease' }} />
                    <line x1="33" y1="7" x2="7" y2="33"
                      stroke={isLine ? teamColor : '#d4af37'} strokeWidth="3.5" strokeLinecap="round"
                      style={{ strokeDasharray:38, strokeDashoffset: isNew ? 38 : 0, transition:'stroke-dashoffset 0.35s ease 0.12s' }} />
                  </svg>
                </div>
              )}

              {/* Label */}
              <span style={{
                fontFamily: 'var(--font-mono)',
                textAlign: 'center',
                color: 'var(--text)',
                lineHeight: 1.1,
                letterSpacing: '0.01em',
                transition: 'opacity 0.3s ease',
                zIndex: 1,
                userSelect: 'none',
                fontWeight: 500,
                opacity: isMarked ? 0.3 : 1,
                fontSize: phrase.length > 14 ? '0.52rem' : phrase.length > 10 ? '0.58rem' : '0.64rem',
                wordBreak: 'break-word',
                maxWidth: '100%',
                padding: '1px',
              }}>{phrase}</span>

              {/* Line glow overlay */}
              {isLine && (
                <div style={{ position:'absolute', inset:0, zIndex:0, borderRadius:'5px', background:`radial-gradient(circle, ${teamColor}28, transparent 70%)` }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Line tracker */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', marginTop:'4px' }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{
            width: '11px', height: '11px', borderRadius: '50%', flexShrink: 0,
            background: i < lines.length ? teamColor : 'rgba(212,175,55,0.12)',
            boxShadow: i < lines.length ? `0 0 10px ${teamColor}80` : 'none',
            transform: i < lines.length ? 'scale(1.2)' : 'scale(1)',
            transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
        ))}
        <span style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1rem', color:teamColor, marginLeft:'4px', textShadow:'0 0 14px currentColor', lineHeight:1 }}>
          {lines.length}/5
        </span>
      </div>

      <style>{`
        @keyframes cellBounce {
          0%  { transform: scale(1); }
          30% { transform: scale(1.2); }
          65% { transform: scale(0.94); }
          100%{ transform: scale(1); }
        }
        .cell-bounce { animation: cellBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>
    </div>
  );
}
