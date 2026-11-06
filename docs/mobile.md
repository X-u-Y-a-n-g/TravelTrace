# TravelTrace Android app

TravelTrace Android is a **standalone, offline** Capacitor app. Photos, trips, places, timeline
events and settings are stored in IndexedDB on the phone; there is no server, account or network
setup. The only optional network use is loading map tiles.

## What is local

- Original photos, 640 px thumbnails and 1600 px previews
- Trips, places, visits and timeline events
- EXIF capture time, GPS, camera and lens metadata
- Favourites, captions, trip/place assignments and timeline edits
- Language preference

Data stays in the app's WebView storage. Clearing Android app data removes it, so use the export
feature for backups.

## Build a debug APK

Requirements: Node.js 22+, JDK 21, Android SDK Platform 35 and Build Tools 35.0.0.

```bash
cd frontend
npm ci
npm run mobile:sync          # build web assets + cap sync android

cd android
./gradlew assembleDebug      # Windows: .\gradlew.bat assembleDebug
```

The APK is written to:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Install it:

```bash
adb install -r frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK to the phone and open it, allowing unknown-source installation.

A prebuilt debug APK is included under [`../mobile/`](../mobile/README.md).

## First launch

There is no server setup. The app opens directly into a local journal with a local user. Create
trips, add photos and generate timelines entirely on the device.

## Importing existing data

The Windows desktop EXE supports importing the old SQLite database and photos. Android starts with
its own local store; existing photos can be added from the phone gallery. A desktop-exported ZIP can
be kept as a backup and its photos copied to the phone if needed.

## Export

Settings → **Export your data** creates a ZIP with `manifest.json`, `trip.json`, `timeline.json`,
`places.geojson`, `photos.json` and the original photos. On Android the ZIP is written to the app
cache and opened through the system share sheet so it can be saved to Files or another app.

## Security and limitations

- The store is inside the Android app sandbox and protected by device encryption/lock, but it is not
  separately encrypted by TravelTrace.
- Map tiles still require internet access; photos and timeline do not.
- No cloud sync, no accounts, no multi-device sync.
- HEIC/HEIF is not supported; JPEG, PNG and WebP are supported.
- Clearing app data deletes the local journal; export a backup first.

## Release signing

Create a keystore outside the repository and configure `signingConfigs` in
`frontend/android/app/build.gradle`, then run `./gradlew assembleRelease` (or `bundleRelease` for
Google Play).
