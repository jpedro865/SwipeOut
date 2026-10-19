import { useColorScheme } from 'react-native'

// Brand fills carry Midnight text: white on Coral is under 3:1 contrast.
const brand = {
  coral: '#FF6B55',
  midnight: '#171627',
  lavender: '#C4A7FF',
  mint: '#80E2BC',
  wash: 'linear-gradient(160deg, rgba(196,167,255,0.16) 0%, rgba(255,107,85,0.08) 100%)', // soft card gradient
}

const dark = { bg: '#171627', card: '#221F38', raised: '#2C2848', text: '#FFFFFF', muted: '#A19DBE', line: '#35304F' }
const light = { bg: '#F7F5FC', card: '#FFFFFF', raised: '#EFEBF8', text: '#171627', muted: '#615D7A', line: '#E4DFF0' }

export function useTheme() {
  return { ...brand, ...(useColorScheme() === 'dark' ? dark : light) }
}
