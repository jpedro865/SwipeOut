import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { t } from './i18n'

// SwipeOut's own notification sound (scripts/make-sounds.mjs), bundled through the expo-notifications plugin.
export const SOUND = 'reminder.wav'
// An Android channel's sound can't change once created, so the reminder moved from 'reminders' to a new channel.
const CHANNEL = 'daily_reminder'

// Serialized so quick taps can't interleave cancel/schedule into duplicate reminders.
// The text is fixed when scheduled, so the root layout reschedules on launch and on a language change.
let queue = Promise.resolve()

// Android 13+ only shows the permission prompt once a channel exists; re-creating it renames it in the current language.
export const channel = async () => {
  if (Platform.OS !== 'android') return
  const old = await Notifications.getNotificationChannelAsync('reminders') // the old channel, default sound
  await Notifications.deleteNotificationChannelAsync('reminders')
  const cur = await Notifications.getNotificationChannelAsync(CHANNEL)
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: t('notif.channel'),
    // Keep what the user chose (off, silent, pop-up), here or on the old channel: a re-create would reset it.
    importance: cur?.importance || old?.importance || Notifications.AndroidImportance.DEFAULT,
    sound: SOUND,
    vibrationPattern: [0, 60, 90, 60, 90, 180], // tap, tap, taaap: the sound's rhythm
  })
}

export const schedule = (minutes: number | null, goal: number) => {
  queue = queue
    .then(async () => {
      await Notifications.cancelAllScheduledNotificationsAsync()
      if (minutes == null) return
      await channel()
      await Notifications.scheduleNotificationAsync({
        content: { title: 'SwipeOut', body: t('notif.body', { n: goal }), sound: SOUND }, // the plugin's color tints it on Android
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: Math.floor(minutes / 60), minute: minutes % 60, channelId: CHANNEL },
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
