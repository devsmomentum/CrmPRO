import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark";

import App from "./App.tsx";
import { ErrorFallback } from "./ErrorFallback.tsx";

// React Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./main.css";
import "./styles/theme.css";
import "./index.css";

// Crear cliente de React Query
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>
);
