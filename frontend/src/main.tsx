import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient, setUnauthorizedHandler } from "./api/client";
import { createUnauthorizedHandler } from "./auth/redirect";
import { getTheme, setTheme } from "./theme/theme";
import { ToastProvider } from "./ui/Toast";
import { router } from "./router";
import "./styles/tokens.css";
import "./index.css";

setTheme(getTheme());
setUnauthorizedHandler(createUnauthorizedHandler(
  (to) => void router.navigate(to),
  () => location.pathname + location.search
));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
);
