import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { StoreProvider, useStore } from '../store'
import { useTheme } from '../theme'

SplashScreen.preventAutoHideAsync()

function Nav() {
  const { data } = useStore()
  const t = useTheme()
  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={data.onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="review" options={{ presentation: 'modal' }} />
          <Stack.Screen name="complete" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        </Stack.Protected>
        <Stack.Protected guard={!data.onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
    </>
  )
}

// The store renders nothing until saved progress is loaded, so the splash covers the gap.
export default function RootLayout() {
  return (
    <StoreProvider>
      <Nav />
    </StoreProvider>
  )
}
