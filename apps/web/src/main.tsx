import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./typography.css";
import "./nodeEditing.css";
import "./formatting.css";
import "./themes.css";
import "./drawing.css";
import { applyTheme, loadTheme } from "./themes";
applyTheme(loadTheme());
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
