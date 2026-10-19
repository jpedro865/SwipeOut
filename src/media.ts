import { File } from 'expo-file-system'
import { Asset, AssetField, MediaType, Query, getPermissionsAsync, presentPermissionsPicker, requestPermissionsAsync, type PermissionResponse } from 'expo-media-library'
import { Platform } from 'react-native'

// Photos only; the same list must go to the plugin config and the runtime request on Android.
// Cast so accessPrivileges ('limited' on iOS / Android 14+) is visible; it is set at runtime.
export const getPermission = () => getPermissionsAsync(false, ['photo']) as Promise<PermissionResponse>
export const requestPermission = () => requestPermissionsAsync(false, ['photo'])
export const pickMorePhotos = () => presentPermissionsPicker(['photo']) // no-op unless access is limited

const PAGE = 2000

// Every photo id, newest first. Ids are ph:// (iOS) or content:// (Android) and render directly in expo-image.
// ponytail: one metadata sweep per load; switch to addListener() deltas if huge libraries feel slow.
export async function allPhotoIds() {
  const ids: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
      .limit(PAGE)
      .offset(offset)
      .exeForMetadata()
    for (const a of page) ids.push(a.id)
    if (page.length < PAGE) return [...new Set(ids)] // offset paging repeats an id if a photo lands mid-sweep
  }
}

// Bytes on device, or 0 when unknown. iCloud-only originals are skipped so we never download to measure.
export async function sizeOf(id: string) {
  try {
    const asset = new Asset(id)
    if (Platform.OS === 'ios' && (await asset.getIsInCloud())) return 0
    return new File(await asset.getUri()).size
  } catch {
    return 0
  }
}

// The OS shows its own confirmation; cancelling rejects. iOS keeps them in Recently Deleted for 30 days.
export const deletePhotos = (ids: string[]) => Asset.delete(ids.map(id => new Asset(id)))
