import Constants from 'expo-constants'
import { requireOptionalNativeModule } from 'expo'
import { Alert, Linking, Platform } from 'react-native'
import { t } from './i18n'
import { newer } from './logic'

// Android asks Google Play (modules/play-update); iOS asks the App Store's public lookup.
const PlayUpdate = requireOptionalNativeModule<{ available(): Promise<boolean> }>('PlayUpdate')

async function storeUrl(): Promise<string | null> {
  if (Platform.OS === 'android') return (await PlayUpdate?.available()) ? 'https://play.google.com/store/apps/details?id=app.swipeout' : null
  const current = Constants.expoConfig?.version
  const app = (await (await fetch('https://itunes.apple.com/lookup?bundleId=app.swipeout')).json()).results?.[0]
  // Skip versions this iOS can't install, or the prompt would come back on every launch.
  return current && app && newer(app.version, current) && !newer(app.minimumOsVersion, String(Platform.Version)) ? app.trackViewUrl : null
}

let asked = false // the root remounts when Android switches language: once per launch is enough

// On launch: point to the store when a newer version is out. Offline or unknown: say nothing.
export async function checkForUpdate() {
  if (asked) return
  asked = true
  const url = await storeUrl().catch(() => null)
  if (url) Alert.alert(t('update.title'), t('update.body'), [
    { text: t('common.notNow'), style: 'cancel' },
    { text: t('update.go'), onPress: () => Linking.openURL(url) },
  ])
}
