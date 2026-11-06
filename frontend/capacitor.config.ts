import type { CapacitorConfig } from "@capacitor/cli";

/**
 * TravelTrace Android shell.
 *
 * The web app is bundled into `dist`; on first launch it asks for the address of
 * the user's self-hosted TravelTrace instance. `androidScheme: "http"` lets the
 * same build talk to HTTP development servers as well as HTTPS production ones.
 */
const config: CapacitorConfig = {
  appId: "com.traveltrace.app",
  appName: "TravelTrace",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#f7f2e8",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#1f3d33",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#f7f2e8",
      overlaysWebView: false,
    },
  },
};

export default config;
