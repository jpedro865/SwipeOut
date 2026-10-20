# Releasing SwipeOut

Everything runs in `.github/workflows/ci.yml`.

| Event | What happens |
|---|---|
| Pull request | Commit subjects are checked (the PR title has its own quick check in `pr-title.yml`), then typecheck, `npm test`, `expo-doctor`, a debug-signed Android release build (arm64) and an unsigned iOS device archive. |
| Push to `master`, or **Run workflow** on `master` | Same checks. If the commits since the last tag include `feat`, `fix` or `perf` (or a breaking change), semantic-release picks the next version. Each platform whose secrets are set is built, signed and pushed to GitHub Packages; a platform without them gets a verify build instead. Then the commit is tagged `vX.Y.Z` with release notes. |

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

## Next: store submission

Store uploads plug in as jobs after the tag job, pulling the packages above by version:

- **Google Play**: upload the `.aab` and the mapping file with a Play Console service account.
- **App Store Connect**: upload the `.ipa` with an App Store Connect API key (`xcrun altool --upload-app --api-key ... --api-issuer ...`).
