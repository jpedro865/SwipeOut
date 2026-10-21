// Synthesizes SwipeOut's UI sounds (44.1 kHz, 16-bit mono WAV). Deterministic: same output every run.
// Usage: node scripts/make-sounds.mjs [outDir=assets/sounds]
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SR = 44100
const N = msec => Math.round((msec * SR) / 1000)
const dB = d => 10 ** (d / 20)

// Seeded PRNG (mulberry32) so the committed WAVs are reproducible.
let seed = 0x5eed
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Envelopes (t in ms). ad: half-sine attack then exponential decay (time constant tau).
const ad = (atk, tau) => t => (t < atk ? Math.sin((Math.PI / 2) * (t / atk)) : Math.exp(-(t - atk) / tau))
const swell = (rise, tau) => t => (t < rise ? (t / rise) ** 2 : Math.exp(-(t - rise) / tau))
// Pitch: start at f*from, settle exponentially to f (tau ms). from<1 = upward "bloop", >1 = downward drop.
const glide = (f, from = 1, tau = 15) => t => f * (1 + (from - 1) * Math.exp(-t / tau))
const sweep = (f0, f1, dur) => t => f0 * (f1 / f0) ** Math.min(1, t / dur) // exponential

// Timbres: [ratio, amp, extra decay tau ms] per partial.
const SOFT = [[1, 1, Infinity], [2, 0.12, 40], [3, 0.03, 20]]
const MARIMBA = [[1, 1, Infinity], [3.93, 0.14, 25], [9.2, 0.03, 8]]
const GLASS = [[1, 1, Infinity], [2.756, 0.3, 150], [5.404, 0.1, 60], [8.933, 0.03, 25]]

// Additive oscillator, mixed into out at `at` ms. Phase-accumulating so glides stay click-free.
function tone(out, at, dur, f, env, partials = SOFT, amp = 1) {
  const s0 = N(at), n = Math.min(N(dur), out.length - s0), ph = partials.map(() => 0)
  for (let i = 0; i < n; i++) {
    const t = (i * 1000) / SR, hz = f(t)
    let v = 0
    partials.forEach(([r, a, tau], k) => {
      ph[k] += (2 * Math.PI * hz * r) / SR
      if (hz * r < 16000) v += a * Math.exp(-t / tau) * Math.sin(ph[k])
    })
    out[s0 + i] += amp * env(t) * v
  }
}

// RBJ-cookbook biquad, coefficients recomputed per sample (allows cutoff sweeps). Bandpass = 0 dB peak.
function biquad(type, Q = Math.SQRT1_2) {
  let z1 = 0, z2 = 0
  return (x, fc) => {
    const w = (2 * Math.PI * Math.min(fc, SR * 0.45)) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al
    const [b0, b1, b2] = type === 'lowpass' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [al, 0, -al]
    const y = (b0 / a0) * x + z1
    z1 = (b1 / a0) * x - ((-2 * c) / a0) * y + z2
    z2 = (b2 / a0) * x - ((1 - al) / a0) * y
    return y
  }
}
const lowpass = (x, fc) => { const f = biquad('lowpass'); return x.map(v => f(v, fc)) }

// Band-passed white noise with a swept centre frequency.
function noise(out, at, dur, fc, Q, env, amp = 1) {
  const s0 = N(at), n = Math.min(N(dur), out.length - s0), f = biquad('bandpass', Q)
  for (let i = 0; i < n; i++) { const t = (i * 1000) / SR; out[s0 + i] += amp * env(t) * f(rand() * 2 - 1, fc(t)) }
}

// Schroeder reverb: 4 parallel damped feedback combs -> 2 series allpasses. Returns dry + mix*wet.
function reverb(x, rt60, mix, damp = 0.4) {
  const wet = new Float64Array(x.length)
  for (const d of [29.7, 37.1, 41.1, 43.7]) {
    const D = N(d), g = 10 ** ((-3 * d) / 1000 / rt60), buf = new Float64Array(D)
    let lp = 0
    for (let i = 0, p = 0; i < x.length; i++, p = (p + 1) % D) {
      const y = buf[p]; lp = y * (1 - damp) + lp * damp; buf[p] = x[i] + g * lp; wet[i] += y / 4
    }
  }
  for (const d of [5, 1.7]) {
    const D = N(d), g = 0.7, buf = new Float64Array(D)
    for (let i = 0, p = 0; i < x.length; i++, p = (p + 1) % D) {
      const vd = buf[p], v = wet[i] + g * vd; wet[i] = -g * v + vd; buf[p] = v
    }
  }
  return x.map((v, i) => v + mix * wet[i])
}

// Click-proof edges + peak normalization (this is the only gain stage, so nothing can clip).
function finish(x, peakDb, fadeOut, fadeIn = 2) {
  const fi = N(fadeIn), fo = N(fadeOut)
  for (let i = 0; i < fi; i++) x[i] *= Math.sin((Math.PI / 2) * (i / fi))
  for (let i = 0; i < fo; i++) x[x.length - 1 - i] *= Math.sin((Math.PI / 2) * (i / fo))
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  return x.map(v => (v * dB(peakDb)) / peak)
}

function writeWav(path, x) {
  const b = Buffer.alloc(44 + x.length * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22) // PCM, mono
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(x.length * 2, 40)
  x.forEach((v, i) => b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2))
  writeFileSync(path, b)
}

// D major pentatonic: everything is consonant with everything, in any order.
const D4 = 293.66, D5 = 587.33, Fs5 = 739.99, A5 = 880, D6 = 1174.66, Fs6 = 1479.98, A6 = 1760
const SOUNDS = {
  keep(o) { // rising 4th A5 -> D6, two soft "bloops" (V -> I: resolved, yes)
    tone(o, 0, 120, glide(A5, 0.94, 12), ad(4, 38), SOFT, 0.55)
    tone(o, 55, 175, glide(D6, 0.94, 12), ad(4, 60), SOFT, 1)
    return finish(reverb(lowpass(o, 5000), 0.35, 0.1, 0.5), -12, 40)
  },
  delete(o) { // soft toss: band-passed whoosh falling 2.6k -> 650 Hz, then a tiny "plop" into the bin
    noise(o, 0, 230, sweep(2600, 650, 200), 1.4, swell(45, 55))
    tone(o, 120, 110, glide(440, 587.33 / 440, 25), ad(3, 35), SOFT, 0.35)
    return finish(reverb(lowpass(o, 4500), 0.3, 0.08, 0.5), -12, 40)
  },
  undo(o) { // reversed-envelope blip gliding up into F#5 + faint rising swish = "rewind"
    tone(o, 0, 160, glide(Fs5, 0.85, 40), swell(90, 18), SOFT, 1)
    noise(o, 0, 160, sweep(900, 2400, 90), 1.2, swell(90, 18), 0.25)
    return finish(lowpass(o, 5000), -15, 20)
  },
  goal(o) { // marimba arpeggio D5 F#5 A5 D6 + low root + A6 glass shimmer, roomy tail
    ;[D5, Fs5, A5].forEach((f, i) => tone(o, i * 75, 900, () => f, ad(3, 220), MARIMBA, 0.6 + i * 0.05))
    tone(o, 225, 1000, () => D6, ad(3, 450), MARIMBA, 0.8)
    tone(o, 225, 1000, () => D4, ad(10, 350), SOFT, 0.4)
    tone(o, 300, 1000, () => A6, ad(3, 500), GLASS, 0.35)
    return finish(reverb(lowpass(o, 8000), 1.1, 0.28), -6, 250)
  },
  achievement(o) { // glassy sparkle A5 D6 A6
    ;[[A5, 0.5, 300], [D6, 0.6, 300], [A6, 0.8, 420]].forEach(([f, a, tau], i) => tone(o, i * 70, 900, () => f, ad(2, tau), GLASS, a))
    return finish(reverb(lowpass(o, 9000), 1.0, 0.3), -8, 200)
  },
  cleared(o) { // rising whoosh ("space freed") resolving on a D5+A5 dyad and an F#6 glint
    noise(o, 0, 600, sweep(500, 3500, 350), 1.0, swell(260, 70), 0.8)
    tone(o, 280, 800, () => D5, ad(3, 260), MARIMBA, 0.5)
    tone(o, 280, 800, () => A5, ad(3, 260), MARIMBA, 0.4)
    tone(o, 340, 760, () => Fs6, ad(2, 350), GLASS, 0.35)
    return finish(reverb(lowpass(o, 9000), 0.9, 0.25), -8, 220)
  },
  // Last on purpose: every sound shares one seeded noise source, so new entries go at the end to keep the others identical.
  reminder(o) { // notification sonic logo, short-short-long: swipe-right swish -> the keep "bloop" pair A5 -> D6 -> F#6 glass ring over D6
    noise(o, 0, 260, sweep(800, 3200, 220), 1.3, swell(170, 45), 1.2)
    tone(o, 150, 220, glide(A5, 0.94, 14), ad(4, 55), SOFT, 0.6)
    tone(o, 240, 500, glide(D6, 0.94, 14), ad(4, 120), SOFT, 0.9)
    tone(o, 390, 1110, () => Fs6, ad(4, 380), GLASS, 0.5)
    tone(o, 390, 1110, () => D6, ad(4, 320), MARIMBA, 0.35)
    return finish(reverb(lowpass(o, 6500), 0.9, 0.2), -3, 250)
  },
}
const LENGTH = { keep: 230, delete: 240, undo: 160, goal: 1300, achievement: 1000, cleared: 1100, reminder: 1500 } // ms, incl. tail

const outDir = process.argv[2] ?? 'assets/sounds'
mkdirSync(outDir, { recursive: true })
for (const [name, make] of Object.entries(SOUNDS)) {
  const x = make(new Float64Array(N(LENGTH[name])))
  // Self-check: finite, never clips, starts/ends at silence. Loudest 50 ms RMS is printed for balancing.
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  if (!x.every(Number.isFinite) || peak > dB(-3) || Math.abs(x[0]) > 1e-3 || Math.abs(x.at(-1)) > 1e-3) throw new Error(`bad ${name}`)
  let loud = 0
  for (let i = 0; i + N(50) <= x.length; i += N(5)) loud = Math.max(loud, Math.sqrt(x.subarray(i, i + N(50)).reduce((s, v) => s + v * v, 0) / N(50)))
  writeWav(join(outDir, `${name}.wav`), x)
  console.log(`${name.padEnd(12)} ${LENGTH[name]} ms  peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS  loudest-50ms RMS ${(20 * Math.log10(loud)).toFixed(1)} dBFS`)
}
