import React from 'react';
export function formatTime(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}
export default function Timer({ seconds = 0, label = 'TIME', large = false }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize: large?'2.4rem':'1.1rem', fontWeight:600, color:'var(--gold)', letterSpacing:'0.06em', textShadow: large?'0 0 30px rgba(212,175,55,0.5)':'none', lineHeight:1 }}>
        {formatTime(seconds)}
      </div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-muted)', letterSpacing:'0.16em', textTransform:'uppercase', marginTop:'2px' }}>
        {label}
      </div>
    </div>
  );
}
