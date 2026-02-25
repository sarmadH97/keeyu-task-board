import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import { ApiError } from "@/api/client";
import "./index.css";
import App from "./App";

const authDomain = import.meta.env.VITE_AUTH0_DOMAIN;
const authClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const authAudience = import.meta.env.VITE_AUTH0_AUDIENCE ?? "https://taskboard-api";
const authRedirectUri = window.location.origin;

if (!authDomain || !authClientId) {
  throw new Error("Missing Auth0 config. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 401) {
          return false;
        }

        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <Auth0Provider
    domain={authDomain}
    clientId={authClientId}
    authorizationParams={{
      redirect_uri: authRedirectUri,
      audience: authAudience,
      scope: "openid profile email",
    }}
    onRedirectCallback={(appState) => {
      const returnTo = typeof appState?.returnTo === "string" ? appState.returnTo : "/boards";
      window.location.replace(returnTo);
    }}
    cacheLocation="localstorage"
  >
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            className: "border border-slate-200",
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </Auth0Provider>,
);
