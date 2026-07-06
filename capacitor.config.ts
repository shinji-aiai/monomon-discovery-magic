import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Monomon iOS app.
 *
 * Monomon is a TanStack Start SSR application (server functions handle AI
 * recognition, Stripe support payments, etc.). SSR apps cannot run as a purely
 * static bundle inside the native shell, so the WKWebView loads the deployed
 * web app via `server.url`. This keeps the native app's behavior identical to
 * the published web experience while still allowing native iOS plugins
 * (camera, status bar, splash screen) to be used.
 *
 * `webDir` still needs to exist for `npx cap sync`; it holds a lightweight
 * offline fallback page (see capacitor/www/index.html).
 */
const config: CapacitorConfig = {
  appId: "com.monomon.app",
  appName: "モノモン",
  webDir: "capacitor/www",
  server: {
    // The published Monomon web app. Update this if the production URL changes.
    url: "https://monomon-discovery-magic.lovable.app",
    cleartext: false,
  },
  ios: {
    // Match Monomon's soft cream background so launch/overscroll feels seamless.
    backgroundColor: "#fbf3e6",
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#fbf3e6",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#fbf3e6",
    },
  },
};

export default config;
