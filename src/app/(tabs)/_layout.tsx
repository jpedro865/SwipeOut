import { NativeTabs } from 'expo-router/native-tabs'
import { t } from '../../i18n'
import { useTheme } from '../../theme'

// Native tab bar: Liquid Glass on iOS 26+, Material 3 on Android (backgroundColor applies before iOS 26).
export default function TabsLayout() {
  const th = useTheme()
  return (
    <NativeTabs
      tintColor={th.coral}
      iconColor={{ default: th.muted, selected: th.coral }}
      labelStyle={{ default: { color: th.muted }, selected: { color: th.coral } }}
      backgroundColor={th.card}
      indicatorColor={th.coral + '33'}
      rippleColor={th.coral + '22'}
      disableTransparentOnScrollEdge // iOS 18 and earlier: keep the card fill at the scroll edge too
    >
      <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: th.bg }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }} md="style" />
        <NativeTabs.Trigger.Label>{t('tab.swipe')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress" contentStyle={{ backgroundColor: th.bg }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'flame', selected: 'flame.fill' }} md="local_fire_department" />
        <NativeTabs.Trigger.Label>{t('tab.progress')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" contentStyle={{ backgroundColor: th.bg }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>{t('tab.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
