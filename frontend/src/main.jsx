import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/manrope";
import App from "./App.jsx";
import { AuthProvider } from "./lib/auth.jsx";
import { ToastProvider } from "./lib/toast.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
