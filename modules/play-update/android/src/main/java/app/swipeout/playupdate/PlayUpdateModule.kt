package app.swipeout.playupdate

import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Asks Google Play whether a newer version is out. Play has no public version lookup, so this is the only accurate source.
// Resolves false when the app wasn't installed from Play (dev builds, sideloaded APKs).
class PlayUpdateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PlayUpdate")

    AsyncFunction("available") { promise: Promise ->
      val context = appContext.reactContext ?: return@AsyncFunction promise.resolve(false)
      AppUpdateManagerFactory.create(context).appUpdateInfo
        .addOnSuccessListener { promise.resolve(it.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) }
        .addOnFailureListener { promise.resolve(false) }
    }
  }
}
