import { Tabs } from 'expo-router/js-tabs'
import { Text } from 'react-native'
import { t } from '../../i18n'
import { useTheme } from '../../theme'

const icon = (glyph: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>
)

export default function TabsLayout() {
  const th = useTheme()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: th.coral,
        tabBarInactiveTintColor: th.muted,
        tabBarStyle: { backgroundColor: th.card, borderTopColor: th.line },
        sceneStyle: { backgroundColor: th.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.swipe'), tabBarIcon: icon('🃏') }} />
      <Tabs.Screen name="progress" options={{ title: t('tab.progress'), tabBarIcon: icon('📈') }} />
      <Tabs.Screen name="profile" options={{ title: t('tab.profile'), tabBarIcon: icon('🏆') }} />
    </Tabs>
  )
}
