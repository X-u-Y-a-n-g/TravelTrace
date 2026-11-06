import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app";
import { I18nProvider } from "./i18n";
import { getStoredApiBase, installNativeLinkHandling, isNativeApp } from "./lib/mobile";
import { MobileSetupPage } from "./pages/mobile-setup";
import { Providers } from "./providers";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

const needsMobileSetup = isNativeApp() && !getStoredApiBase();
installNativeLinkHandling();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Providers>
      <I18nProvider>
        {needsMobileSetup ? <MobileSetupPage /> : <App />}
      </I18nProvider>
    </Providers>
  </React.StrictMode>,
);
