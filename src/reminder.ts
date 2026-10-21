import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { t } from './i18n'

// Serialized so quick stepper taps can't interleave cancel/schedule into duplicate reminders.
// The text is fixed when scheduled, so the root layout reschedules on launch and on a language change.
let queue = Promise.resolve()
// Android 13+ only shows the permission prompt once a channel exists; re-creating it renames it in the current language.
export const channel = async () => {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: t('notif.channel'), importance: Notifications.AndroidImportance.DEFAULT })
}
export const schedule = (minutes: number | null, goal: number) => {
  queue = queue
    .then(async () => {
      await Notifications.cancelAllScheduledNotificationsAsync()
      if (minutes == null) return
      await channel()
      await Notifications.scheduleNotificationAsync({
        content: { title: 'SwipeOut', body: t('notif.body', { n: goal }) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: Math.floor(minutes / 60), minute: minutes % 60, channelId: 'reminders' },
      })
    })
    .catch(e => console.warn('swipeout: could not schedule reminder', e))
}

// 'blocked': only system settings can turn them on now. null: not allowed, but asking again is possible.
export type Perm = 'granted' | 'blocked' | null
export const permState = (p: Notifications.NotificationPermissionsStatus): Perm => (p.granted ? 'granted' : p.canAskAgain ? null : 'blocked')

async function ask() {
  await channel()
  let p = await Notifications.getPermissionsAsync()
  if (!p.granted && p.canAskAgain) p = await Notifications.requestPermissionsAsync()
  return permState(p)
}
// Asks only on an explicit tap; a double tap waits on the same prompt instead of queuing a second one.
let asking: Promise<Perm> | null = null
export const allowNotifications = () => (asking ??= ask().finally(() => { asking = null }))
