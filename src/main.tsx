import React from "react";
import ReactDOM from "react-dom/client";
import { Tooltip } from "radix-ui";
import { App } from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Tooltip.Provider>
      <App />
    </Tooltip.Provider>
  </React.StrictMode>,
);
