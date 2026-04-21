import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSentry, Sentry } from "./lib/sentry";

initSentry();

const Root = (
  <Sentry.ErrorBoundary
    fallback={
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
          background: "hsl(240 10% 6%)",
          color: "hsl(40 10% 95%)",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Something went wrong.
          </h1>
          <p style={{ color: "hsl(240 5% 65%)" }}>
            The error has been reported. Try reloading the page.
          </p>
        </div>
      </div>
    }
  >
    <App />
  </Sentry.ErrorBoundary>
);

createRoot(document.getElementById("root")!).render(Root);
