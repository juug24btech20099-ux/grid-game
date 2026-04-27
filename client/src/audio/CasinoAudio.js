/**
 * CasinoAudio — procedural soundtrack engine using Web Audio API
 * Generates casino/lounge music entirely in the browser, no audio files needed.
 * Tracks cycle without repetition for the entire session.
 */

let ctx = null;
let masterGain = null;
let currentTrack = null;
let trackIndex = 0;
let isPlaying = false;
let volume = 0.35;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── Utility ──────────────────────────────────────────────────────────────────

function note(freq, startTime, duration, gainVal, type = 'sine', ac = null) {
  const a = ac || getCtx();
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(gainVal, startTime + 0.02);
  g.gain.linearRampToValueAtTime(gainVal * 0.7, startTime + duration * 0.6);
  g.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
  return osc;
}

function chord(freqs, startTime, duration, gainVal = 0.08, type = 'sine') {
  freqs.forEach(f => note(f, startTime, duration, gainVal, type));
}

function hihat(startTime, gain = 0.04) {
  const a = getCtx();
  const buf = a.createBuffer(1, a.sampleRate * 0.05, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 8000;
  src.connect(f);
  f.connect(g);
  g.connect(masterGain);
  g.gain.setValueAtTime(gain, startTime);
  g.gain.linearRampToValueAtTime(0, startTime + 0.05);
  src.start(startTime);
}

function kick(startTime, gain = 0.15) {
  const a = getCtx();
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.frequency.setValueAtTime(150, startTime);
  osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.1);
  g.gain.setValueAtTime(gain, startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
  osc.connect(g); g.connect(masterGain);
  osc.start(startTime); osc.stop(startTime + 0.35);
}

function snare(startTime, gain = 0.07) {
  const a = getCtx();
  const buf = a.createBuffer(1, a.sampleRate * 0.15, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3));
  const src = a.createBufferSource(); src.buffer = buf;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, startTime);
  src.connect(g); g.connect(masterGain);
  src.start(startTime);
}

function bass(freq, startTime, duration, gain = 0.12) {
  note(freq, startTime, duration, gain, 'sawtooth');
  note(freq * 2, startTime, duration, gain * 0.3, 'sine');
}

// ── Track Definitions ────────────────────────────────────────────────────────

const TRACKS = [

  // Track 0 — "The Gambit" (slow jazz lounge, 70 BPM)
  function trackGambit(startTime) {
    const a = getCtx();
    const bpm = 70, beat = 60 / bpm;
    const BARS = 16;
    // Jazz chords: Cm7, Fm7, G7, Cm7
    const progression = [
      [130.81, 155.56, 196, 233.08], // Cm7
      [174.61, 207.65, 261.63, 311.13], // Fm7
      [196, 246.94, 293.66, 370], // G7
      [130.81, 155.56, 196, 233.08], // Cm7
    ];
    const bassNotes = [65.41, 87.31, 98, 65.41];
    for (let bar = 0; bar < BARS; bar++) {
      const t = startTime + bar * beat * 4;
      const chordIdx = Math.floor(bar / 4) % progression.length;
      chord(progression[chordIdx], t, beat * 3.5, 0.06, 'sine');
      bass(bassNotes[chordIdx], t, beat * 1.8, 0.1);
      bass(bassNotes[chordIdx], t + beat * 2, beat * 1.8, 0.08);
      // Hi-hat pattern
      for (let i = 0; i < 8; i++) hihat(t + i * beat * 0.5, i % 2 === 0 ? 0.04 : 0.025);
      kick(t, 0.12); kick(t + beat * 2, 0.1);
      snare(t + beat, 0.06); snare(t + beat * 3, 0.06);
      // Melody notes
      const melScale = [130.81, 146.83, 155.56, 174.61, 196, 207.65, 233.08, 261.63];
      const mel = [4, 6, 5, 4, 3, 4, 2, 1];
      mel.forEach((idx, i) => note(melScale[idx], t + i * beat * 0.5, beat * 0.45, 0.07, 'triangle'));
    }
    return BARS * beat * 4;
  },

  // Track 1 — "High Stakes" (uptempo casino, 95 BPM)
  function trackHighStakes(startTime) {
    const bpm = 95, beat = 60 / bpm;
    const BARS = 16;
    const chords = [
      [220, 261.63, 329.63], // Am
      [196, 246.94, 293.66], // G
      [174.61, 220, 261.63], // F
      [196, 246.94, 329.63], // Em7
    ];
    const bassN = [110, 98, 87.31, 98];
    for (let bar = 0; bar < BARS; bar++) {
      const t = startTime + bar * beat * 4;
      const ci = Math.floor(bar / 2) % chords.length;
      chord(chords[ci], t, beat * 1.9, 0.07, 'triangle');
      chord(chords[ci], t + beat * 2, beat * 1.9, 0.06, 'triangle');
      bass(bassN[ci], t, beat * 3.8, 0.11);
      // Driving hi-hats
      for (let i = 0; i < 16; i++) hihat(t + i * beat * 0.25, i % 4 === 0 ? 0.05 : 0.03);
      kick(t); kick(t + beat * 2.5, 0.09);
      snare(t + beat); snare(t + beat * 3);
      // Riff
      const riff = [220, 246.94, 261.63, 220, 196, 220];
      riff.forEach((f, i) => note(f, t + i * beat * 0.5, beat * 0.4, 0.08, 'sawtooth'));
    }
    return BARS * beat * 4;
  },

  // Track 2 — "Velvet Room" (slow luxurious, 60 BPM)
  function trackVelvet(startTime) {
    const bpm = 60, beat = 60 / bpm;
    const BARS = 12;
    // Lush Eb major chords
    const chords = [
      [155.56, 195.99, 233.08, 311.13], // Ebmaj7
      [130.81, 164.81, 196, 261.63],    // Cm7
      [116.54, 155.56, 185, 233.08],    // Abmaj7
      [130.81, 174.61, 196, 261.63],    // Bb7
    ];
    const bassN = [77.78, 65.41, 58.27, 58.27];
    for (let bar = 0; bar < BARS; bar++) {
      const t = startTime + bar * beat * 4;
      const ci = Math.floor(bar / 3) % chords.length;
      // Arpeggiated chords
      chords[ci].forEach((f, i) => note(f, t + i * beat * 0.25, beat * 3, 0.055, 'sine'));
      bass(bassN[ci], t, beat * 4, 0.09);
      // Soft brushes
      for (let i = 0; i < 8; i++) hihat(t + i * beat * 0.5, 0.02);
      kick(t, 0.1); snare(t + beat * 2, 0.05);
    }
    return BARS * beat * 4;
  },

  // Track 3 — "Neon Casino" (funky groove, 108 BPM)
  function trackNeon(startTime) {
    const bpm = 108, beat = 60 / bpm;
    const BARS = 16;
    const bassLine = [73.42, 73.42, 87.31, 73.42, 65.41, 73.42, 77.78, 65.41];
    const chords = [
      [293.66, 369.99, 440],   // Dm7
      [261.63, 329.63, 392],   // C
      [246.94, 311.13, 369.99],// Bm7b5
      [293.66, 369.99, 493.88],// Dm9
    ];
    for (let bar = 0; bar < BARS; bar++) {
      const t = startTime + bar * beat * 4;
      const ci = Math.floor(bar / 4) % chords.length;
      // Funky stabs
      chord(chords[ci], t + beat * 0.5, beat * 0.3, 0.09, 'square');
      chord(chords[ci], t + beat * 1.5, beat * 0.3, 0.07, 'square');
      chord(chords[ci], t + beat * 3, beat * 0.3, 0.09, 'square');
      // Bass groove
      bassLine.forEach((f, i) => bass(f, t + i * beat * 0.5, beat * 0.45, 0.13));
      // Tight hi-hats
      for (let i = 0; i < 16; i++) hihat(t + i * beat * 0.25, i % 2 === 0 ? 0.045 : 0.02);
      kick(t); kick(t + beat * 2, 0.11); kick(t + beat * 3.5, 0.08);
      snare(t + beat); snare(t + beat * 3);
    }
    return BARS * beat * 4;
  },

  // Track 4 — "Final Countdown" (tense cinematic, 80 BPM)
  function trackFinalCountdown(startTime) {
    const bpm = 80, beat = 60 / bpm;
    const BARS = 16;
    const tension = [
      [196, 233.08, 293.66], // Gm
      [185, 220, 277.18],    // Fm#5
      [174.61, 220, 261.63], // Fm
      [164.81, 196, 246.94], // Em
    ];
    for (let bar = 0; bar < BARS; bar++) {
      const t = startTime + bar * beat * 4;
      const ci = bar % tension.length;
      chord(tension[ci], t, beat * 2, 0.08, 'sawtooth');
      chord(tension[ci].map(f => f * 0.5), t, beat * 4, 0.1, 'sine');
      bass(tension[ci][0] / 2, t, beat * 4, 0.12);
      // Urgent hi-hats
      for (let i = 0; i < 16; i++) hihat(t + i * beat * 0.25, 0.04);
      kick(t); kick(t + beat); kick(t + beat * 2); kick(t + beat * 3);
      snare(t + beat * 0.5); snare(t + beat * 2.5);
      // Pulsing accent
      note(tension[ci][2] * 2, t, beat * 0.2, 0.05, 'triangle');
    }
    return BARS * beat * 4;
  },

  // Track 5 — "Between Rounds" (chill intermission, 75 BPM)
  function trackInterlude(startTime) {
    const bpm = 75, beat = 60 / bpm;
    const BARS = 12;
    const chords = [
      [261.63, 329.63, 392, 493.88], // Cmaj9
      [220, 277.18, 329.63, 415.3],  // Am9
      [196, 246.94, 293.66, 392],    // G9
      [174.61, 220, 261.63, 329.63], // Fmaj7
    ];
    for (let bar = 0; bar < BARS; bar++) {
      const t = startTime + bar * beat * 4;
      const ci = Math.floor(bar / 3) % chords.length;
      chords[ci].forEach((f, i) => note(f, t + i * beat * 0.5, beat * 2, 0.05, 'sine'));
      bass(chords[ci][0] / 2, t, beat * 4, 0.08);
      for (let i = 0; i < 8; i++) hihat(t + i * beat * 0.5, 0.025);
      snare(t + beat * 2, 0.04);
    }
    return BARS * beat * 4;
  },
];

// Shuffle track order for non-repeating sequence
let trackOrder = [];
function buildOrder() {
  trackOrder = TRACKS.map((_, i) => i);
  for (let i = trackOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trackOrder[i], trackOrder[j]] = [trackOrder[j], trackOrder[i]];
  }
  trackIndex = 0;
}
buildOrder();

let scheduledStop = null;

function playNext() {
  if (!isPlaying) return;
  const a = getCtx();
  const idx = trackOrder[trackIndex % trackOrder.length];
  trackIndex++;
  if (trackIndex >= trackOrder.length) { buildOrder(); } // reshuffle when all played
  const startTime = a.currentTime + 0.1;
  const duration = TRACKS[idx](startTime);
  if (scheduledStop) clearTimeout(scheduledStop);
  scheduledStop = setTimeout(playNext, duration * 1000);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startAudio() {
  if (isPlaying) return;
  isPlaying = true;
  getCtx();
  playNext();
}

export function stopAudio() {
  isPlaying = false;
  if (scheduledStop) { clearTimeout(scheduledStop); scheduledStop = null; }
  if (ctx) { ctx.suspend(); }
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (masterGain) masterGain.gain.setValueAtTime(volume, getCtx().currentTime);
}

export function playEffect(type) {
  const a = getCtx();
  const t = a.currentTime;
  if (type === 'correct') {
    note(523.25, t, 0.1, 0.15, 'sine');
    note(659.25, t + 0.1, 0.1, 0.15, 'sine');
    note(783.99, t + 0.2, 0.2, 0.15, 'sine');
  } else if (type === 'wrong') {
    note(200, t, 0.15, 0.1, 'sawtooth');
    note(150, t + 0.12, 0.2, 0.08, 'sawtooth');
  } else if (type === 'bingo') {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, t + i * 0.1, 0.25, 0.18, 'sine'));
    note(1318.51, t + 0.4, 0.4, 0.2, 'sine');
  } else if (type === 'winner') {
    [261.63,329.63,392,523.25,659.25,783.99,1046.5].forEach((f,i)=>note(f,t+i*0.08,0.3,0.16,'sine'));
  } else if (type === 'hack') {
    note(440, t, 0.05, 0.2, 'square');
    note(880, t + 0.06, 0.05, 0.2, 'square');
    note(440, t + 0.12, 0.05, 0.2, 'square');
    note(1760, t + 0.18, 0.15, 0.15, 'square');
  } else if (type === 'freeze') {
    [880, 1108.73, 1318.51].forEach((f, i) => note(f, t + i * 0.06, 0.2, 0.12, 'triangle'));
  } else if (type === 'roundEnd') {
    chord([261.63, 329.63, 392, 493.88], t, 1.5, 0.12, 'sine');
    note(523.25, t + 0.5, 1.0, 0.14, 'sine');
  } else if (type === 'roundStart') {
    kick(t, 0.2); kick(t + 0.15, 0.15); kick(t + 0.3, 0.2);
    note(440, t + 0.4, 0.4, 0.18, 'sine');
    note(880, t + 0.8, 0.6, 0.2, 'sine');
  }
}

export function resumeCtx() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
