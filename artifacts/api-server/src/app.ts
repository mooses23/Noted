import { initSentry, Sentry } from "./lib/sentry";

// Sentry must be initialized before importing the rest of the app so its
// auto-instrumentation can patch http/express/etc.
initSentry();

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const isProduction = process.env.NODE_ENV === "production";
const rawAllowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const invalidOrigins: string[] = [];
const corsAllowlist: string[] = [];
for (const entry of rawAllowedOrigins) {
  try {
    const url = new URL(entry);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      invalidOrigins.push(entry);
      continue;
    }
    corsAllowlist.push(entry);
  } catch {
    invalidOrigins.push(entry);
  }
}

if (isProduction) {
  if (rawAllowedOrigins.length === 0) {
    logger.error(
      "*** CORS MISCONFIGURATION: ALLOWED_ORIGINS is missing or empty in production. " +
        "All browser requests will be rejected. Set ALLOWED_ORIGINS to a comma-separated " +
        "list of allowed origins (e.g. https://example.com,https://app.example.com). ***",
    );
  }
  if (invalidOrigins.length > 0) {
    logger.error(
      { invalidOrigins },
      `*** CORS MISCONFIGURATION: ALLOWED_ORIGINS contains ${invalidOrigins.length} ` +
        `invalid entr${invalidOrigins.length === 1 ? "y" : "ies"}: ` +
        `${invalidOrigins.map((v) => JSON.stringify(v)).join(", ")}. ` +
        "Each entry must be a full URL with an http:// or https:// scheme. ***",
    );
  }
}

// Replit dev-domain fallback only applies outside production. In production
// the allowlist is driven entirely by ALLOWED_ORIGINS.
if (!isProduction) {
  const devDomain = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : null;
  if (devDomain && !corsAllowlist.includes(devDomain)) corsAllowlist.push(devDomain);
}

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      // Non-browser or same-origin (no Origin header): allow.
      if (!origin) return cb(null, true);
      if (corsAllowlist.length === 0) {
        if (process.env.NODE_ENV === "production") {
          return cb(new Error("CORS: allowlist not configured"));
        }
        // Dev fallback only: allow when no explicit allowlist configured.
        return cb(null, true);
      }
      if (corsAllowlist.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin not allowed: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

// Sentry's express error handler must come after routes but before any other
// custom error middleware so it captures unhandled exceptions with request
// context. It only acts when Sentry was actually initialized.
Sentry.setupExpressErrorHandler(app);

// Final JSON error handler: keeps responses consistent and avoids leaking
// stack traces. The handler signature must declare 4 args for Express to
// recognize it as an error middleware.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof (err as { status?: unknown })?.status === "number"
      ? (err as { status: number }).status
      : typeof (err as { statusCode?: unknown })?.statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;

  if (status >= 500) {
    logger.error({ err, reqId: req.id }, "Unhandled error in request");
    // Tag so dashboards/alerts can filter `http_status_code:5xx` reliably.
    Sentry.withScope((scope) => {
      scope.setTag("http_status_code", String(status));
      scope.setTag("http_method", req.method);
      Sentry.captureException(err);
    });
  }

  if (res.headersSent) return;
  res.status(status).json({
    error: status >= 500 ? "Internal Server Error" : (err as Error)?.message ?? "Error",
  });
});

export default app;
