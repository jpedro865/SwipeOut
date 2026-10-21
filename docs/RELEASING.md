# Releasing SwipeOut

Everything runs in `.github/workflows/ci.yml`, which hands Android releases to `.github/workflows/play.yml` for Google Play.

| Event | What happens |
|---|---|
| Pull request | Commit subjects are checked (the PR title has its own quick check in `pr-title.yml`), then typecheck, `npm test`, `expo-doctor`, a debug-signed Android release build (arm64) and an unsigned iOS device archive. |
| Push to `master`, or **Run workflow** on `master` | Same checks. If the commits since the last tag include `feat`, `fix` or `perf` (or a breaking change), semantic-release picks the next version. Each platform whose secrets are set is built, signed and pushed to GitHub Packages; a platform without them gets a verify build instead. Then the commit is tagged `vX.Y.Z` with release notes, and the Android build is sent to Google Play's closed test once [Google Play](#google-play) is set up. |

Binaries are never uploaded as workflow artifacts or attached to GitHub Releases: on a public repo, both can be downloaded by anyone.

## Commit messages decide the version

Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): subject`.

| Commit | Release |
|---|---|
| `fix: ...`, `perf: ...` | patch (1.0.**1**) |
| `feat: ...` | minor (1.**1**.0) |
| `feat!: ...` or a `BREAKING CHANGE:` footer | major (**2**.0.0) |
| `chore`, `build`, `ci`, `docs`, `refactor`, `style`, `test` | none |

A squash merge uses the PR title as the commit subject, so the title is checked too, and re-checked whenever it's edited. Git's `Revert "..."` subjects are accepted.

The store build number is derived from the version (`1.2.3` → `1002003`), so it always grows.

## One-time setup

### 1. The `production` environment

Signing secrets live in a `production` environment, so only `master` can read them:

1. **Settings → Environments → New environment** → `production`.
2. Under **Deployment branches and tags**, choose **Selected branches and tags** and add `master`.
3. Add the secrets below as **environment secrets**.

Each platform ships as soon as `GHCR_TOKEN` and its own secrets exist, so Android can release before iOS is set up. A platform without its secrets gets a verify build and a warning naming what's missing. A version released without iOS has no iOS build; iOS joins from the next release after its secrets are added.

| Platform | Needs |
|---|---|
| Android | `GHCR_TOKEN` + the four `ANDROID_UPLOAD_*` secrets |
| iOS | `GHCR_TOKEN` + the three `IOS_*` secrets (requires a paid Apple Developer Program membership) |

### 2. Android secrets (upload key for Google Play App Signing)

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -i upload.jks | pbcopy
```

| Secret | Value |
|---|---|
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | the base64 output above |
| `ANDROID_UPLOAD_STORE_PASSWORD` | the keystore password |
| `ANDROID_UPLOAD_KEY_ALIAS` | `upload` |
| `ANDROID_UPLOAD_KEY_PASSWORD` | the same keystore password (PKCS12 keystores have a single password) |

Keep `upload.jks` somewhere safe outside the repo. Losing it means asking Google to reset the upload key.

### 3. iOS secrets (App Store distribution)

1. In Apple Developer, create an **Apple Distribution** certificate. Export it from Keychain Access as a `.p12` with a password.
2. Register the App ID `app.swipeout`, then create an **App Store Connect** provisioning profile for it with that certificate.

```bash
base64 -i AppleDistribution.p12 | pbcopy
base64 -i SwipeOut_AppStore.mobileprovision | pbcopy
```

| Secret | Value |
|---|---|
| `IOS_DIST_P12_BASE64` | the `.p12`, base64 |
| `IOS_DIST_P12_PASSWORD` | the `.p12` password |
| `IOS_PROFILE_BASE64` | the `.mobileprovision`, base64 |

The team ID and profile UUID are read from the profile. The certificate and profile expire after a year; renew both secrets then.

### 4. Private packages and the publish token

Releases are pushed with a dedicated token, not the workflow's own `GITHUB_TOKEN`. Giving this public repo access to the packages would let fork pull requests read them, and GitHub's docs disagree on whether a package first created by a workflow inherits the repo's public visibility. A public package can never be made private again. So you create both packages yourself, privately, and the release jobs refuse to push to a missing or public one.

1. Create a classic token with only `write:packages`: <https://github.com/settings/tokens/new?scopes=write:packages>. Give it an expiry you'll remember to renew, such as a year. Opening the page through this link keeps the full `repo` scope from being added.
2. Create both packages with it ([ORAS](https://oras.land) installed):

   ```bash
   echo "$TOKEN" | oras login ghcr.io -u jpedro865 --password-stdin
   echo bootstrap > bootstrap.txt
   oras push ghcr.io/jpedro865/swipeout/android:bootstrap bootstrap.txt
   oras push ghcr.io/jpedro865/swipeout/ios:bootstrap bootstrap.txt
   ```

3. On github.com (**Your profile → Packages**), check that both show **Private**. Don't link them to the repo or add it under **Manage Actions access**.
4. Add the token to the `production` environment as `GHCR_TOKEN`.

| Secret | Value |
|---|---|
| `GHCR_TOKEN` | the `write:packages` token |

## Getting the binaries

```bash
echo "$TOKEN" | oras login ghcr.io -u jpedro865 --password-stdin   # a read:packages token: https://github.com/settings/tokens/new?scopes=read:packages
oras pull ghcr.io/jpedro865/swipeout/android:1.2.3 -o dist/   # .aab, .apk, R8 mapping
oras pull ghcr.io/jpedro865/swipeout/ios:1.2.3 -o dist/       # .ipa, dSYMs
```

A version is final once its `vX.Y.Z` tag exists. If a run fails after the packages were pushed but before tagging, the next master run rebuilds and overwrites them.

## When a release run fails

- **A build failed for an outside reason** (runner, network, Apple or Google outage) and `master` hasn't moved: **Re-run all jobs**. Nothing is tagged until every platform that was due has been signed and pushed, so the re-run picks up the same version and starts over.
- **The code needs a fix**: push it. That run releases everything since the last tag.
- **The tag was created but the release notes weren't** (the "Tag & release notes" log shows `Created tag vX.Y.Z` before the error): re-runs won't fix this, because the version is already released. Create the GitHub release by hand from that tag (**Releases → Draft a new release → choose the tag → Generate release notes**).

The signed build jobs refuse to push a version that's already tagged, so re-running an old run can't overwrite a released build.

## Google Play

Once a version is tagged, `play.yml` pulls its `.aab` and R8 mapping from the private package, uploads them to Play's **closed testing** track (`alpha`) and sends the release for review. Once Google approves it, testers get the update. The internal track isn't used: people who join internal testing can't count toward the closed test that production access needs.

- **A newer release replaces one still in review.** Play cancels the pending review and reviews the newer build instead, so the latest version always reaches testers.
- **After a rejected review**, Play won't auto-submit. The upload is still saved on the track, and the run warns you to fix the rejection and send it from **Play Console → Publishing overview**.
- **Run it by hand** to (re)send any tagged version: **Actions → Google Play → Run workflow** on `master`, with the version (e.g. `1.2.0`). A version Play already has is rejected ("version code already used").

### Sign-in: Workload Identity Federation (no stored key)

There is no Google key in GitHub. A job in this repo's `production` environment on `master` presents GitHub's OIDC token to Google, which exchanges it for a one-hour token of a service account. That service account can only release to testing tracks.

Run once with [gcloud](https://cloud.google.com/sdk/docs/install), signed in as the Play Console owner. `1426710998` is this repo's ID (`gh api repos/jpedro865/SwipeOut -q .id`), which survives renames:

```bash
P=swipeout-release   # any unused Cloud project ID
gcloud projects create "$P"
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com androidpublisher.googleapis.com --project "$P"
gcloud iam service-accounts create play-publisher --project "$P" --display-name "SwipeOut CI: Google Play"
gcloud iam workload-identity-pools create github --project "$P" --location global
gcloud iam workload-identity-pools providers create-oidc swipeout --project "$P" --location global --workload-identity-pool github \
  --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping google.subject=assertion.sub,attribute.repository_id=assertion.repository_id \
  --attribute-condition "assertion.repository_id == '1426710998' && assertion.environment == 'production' && assertion.ref == 'refs/heads/master'"
N=$(gcloud projects describe "$P" --format 'value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding "play-publisher@$P.iam.gserviceaccount.com" --project "$P" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$N/locations/global/workloadIdentityPools/github/attribute.repository_id/1426710998"
```

Then:

1. In **Play Console → Users and permissions → Invite new users**, enter `play-publisher@<project>.iam.gserviceaccount.com`. Under **App permissions**, add SwipeOut with only **Release apps to testing tracks**, then **Invite user**. Google says permission changes can take up to 48 hours to apply.
2. Wait until Google has approved the first release. Until then the app is a draft, and Play only accepts draft releases.
3. Add two **environment variables** (not secrets) to `production`:

| Variable | Value |
|---|---|
| `PLAY_WIF_PROVIDER` | `projects/<project number>/locations/global/workloadIdentityPools/github/providers/swipeout` |
| `PLAY_SERVICE_ACCOUNT` | `play-publisher@<project>.iam.gserviceaccount.com` |

Until both are set, releases skip Google Play with a warning. To send the latest version that was released before the setup, run the workflow by hand.

### Production

Once 12 testers have stayed opted in to the closed test for 14 days, apply for production access from the Play Console **Dashboard**. It asks about the closed test, including how you collected tester feedback, and Google's review usually takes up to 7 days. Releasing there will then need the **Release to production, exclude devices, and use Play App Signing** permission and a step that promotes the tested build to the `production` track.

## Next: App Store

Store uploads plug in as jobs after the tag job, pulling the packages above by version: upload the `.ipa` to **App Store Connect** with an App Store Connect API key (`xcrun altool --upload-app --api-key ... --api-issuer ...`).
