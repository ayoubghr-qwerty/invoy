import React from "react";
import ReactDOM from "react-dom/client";
import { installTauriApi } from "./tauriApi";
import App from "./App";
import "./index.css";

// Install `window.api` (Tauri implementation) before the app renders.
installTauriApi();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
