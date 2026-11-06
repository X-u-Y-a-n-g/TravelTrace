# TravelTrace Android APK

`TravelTrace-0.3.0-debug.apk` is a debug-signed APK built from `frontend/android`. It is a fully
offline, standalone app.

- Package: `com.traveltrace.app`
- Version: `0.3.0` (`versionCode 3`)
- Min Android: 6.0 (API 23)
- Target SDK: 35
- SHA-256: `1CE852F5C3E68A5ED5C95256751057508B5D618E55022C64A63F4366BADDC3FD`

## Install

With a connected device and `adb`:

```bash
adb install -r mobile/TravelTrace-0.3.0-debug.apk
```

Or copy the APK to the phone and open it, allowing installation from unknown sources.

## First launch

No server address or account is needed. The app opens directly into a local journal. Data is stored
in the app's local storage; clearing app data deletes it.

Use **Settings → Export your data** to save a ZIP backup. Android opens the system share sheet so it
can be saved to Files or sent to another app.

The debug APK is for testing only. Build a signed release before distributing it; see
[`docs/mobile.md`](../docs/mobile.md).
