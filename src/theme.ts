import { useColorScheme } from 'react-native'

// Brand fills carry Midnight text: white on Coral is under 3:1 contrast.
export const brand = { coral: '#FF6B55', midnight: '#171627', lavender: '#C4A7FF', mint: '#80E2BC' }

const dark = { bg: '#171627', card: '#221F38', raised: '#2C2848', text: '#FFFFFF', muted: '#A19DBE', line: '#35304F' }
const light = { bg: '#F7F5FC', card: '#FFFFFF', raised: '#EFEBF8', text: '#171627', muted: '#615D7A', line: '#E4DFF0' }

export type Theme = typeof brand & typeof dark & { dark: boolean }

export function useTheme(): Theme {
  const isDark = useColorScheme() === 'dark'
  return { ...brand, ...(isDark ? dark : light), dark: isDark }
}
