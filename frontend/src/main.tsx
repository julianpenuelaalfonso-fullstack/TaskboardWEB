import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "./api/client";
import { getTheme, setTheme } from "./theme/theme";
import { ToastProvider } from "./ui/Toast";
import { router } from "./router";
import "./styles/tokens.css";
import "./index.css";

setTheme(getTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
);
