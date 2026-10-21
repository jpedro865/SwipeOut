import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'

// UI sounds, synthesized by scripts/make-sounds.mjs (loudness is baked in). Ambient session: the silent
// switch (or Android silent/vibrate) mutes them, and they mix over the user's music instead of pausing it.
setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {})

const players = {
  keep: createAudioPlayer(require('../assets/sounds/keep.wav')),
  delete: createAudioPlayer(require('../assets/sounds/delete.wav')),
  undo: createAudioPlayer(require('../assets/sounds/undo.wav')),
  goal: createAudioPlayer(require('../assets/sounds/goal.wav')),
  achievement: createAudioPlayer(require('../assets/sounds/achievement.wav')),
  cleared: createAudioPlayer(require('../assets/sounds/cleared.wav')),
  reminder: createAudioPlayer(require('../assets/sounds/reminder.wav')), // the notification sound, previewed in setup
}
players.reminder.volume = 0.5 // mastered ~9 dB hotter than the UI sounds, like a real notification
export type Sound = keyof typeof players

// Replaying restarts the sound, so quick swipes never stack. Pause first: on Android a finished player
// would otherwise restart on seekTo alone, skipping play()'s silent-mode check.
export function play(name: Sound, on: boolean) {
  if (!on) return
  const p = players[name]
  p.pause()
  p.seekTo(0).then(() => p.play(), () => {})
}
