# TravelTrace Android APK

`TravelTrace-0.2.0-debug.apk` is a debug-signed APK built from
`frontend/android` for sideloading and testing.

- Package: `com.traveltrace.app`
- Version: `0.2.0` (`versionCode 2`)
- Min Android: 6.0 (API 23)
- Target SDK: 35
- Size: ~5.8 MB
- SHA-256: `839D3E05AA71EF15E11BE807A2475EB66E9E4C00593E5B458054AF5D8CC42F06`

## Install

With a connected device and `adb`:

```bash
adb install -r mobile/TravelTrace-0.2.0-debug.apk
```

Or copy the APK to the phone and open it, allowing installation from unknown sources.

## First launch

Enter the address of your TravelTrace server (for example
`http://192.168.1.20:8080` or `https://travel.example.com`) and tap **Connect**.

- Physical phone + Docker Compose on the same Wi-Fi: `http://<computer-LAN-IP>:8080`
- Android emulator + local backend: `http://10.0.2.2:8000`
- Android emulator + Docker Compose: `http://10.0.2.2:8080`
- Production: an HTTPS URL

The debug APK is for testing only. Build a signed release before distributing it; see
[`docs/mobile.md`](../docs/mobile.md).
