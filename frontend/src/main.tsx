import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app";
import { Providers } from "./providers";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
);
