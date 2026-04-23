// MUST be the first import in this file. ESM hoists imports, and
// envValidation collects production env problems as a module-load side
// effect (without throwing — see envValidation.ts for the rationale).
// Putting it first ensures validation runs before any other module
// (sentry, router, @workspace/db, etc.) is evaluated — those modules
// read process.env at load time and would otherwise crash with a less
// informative error before our consolidated check could fire.
import {
  formatEnvProblems,
  productionEnvProblems,
} from "./lib/envValidation";

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

// Guard middleware: if the production env validator found problems, every
// request short-circuits with a readable 500 naming the offending vars.
// This MUST be the first middleware so it runs before CORS/Clerk/etc.
// can fail in a less informative way. We capture problems instead of
// throwing because Vercel inlines this bundle into the function via ncc
// — a throw at module-init kills the function before any handler runs.
if (productionEnvProblems.length > 0) {
  const message = formatEnvProblems(productionEnvProblems);
  app.use((_req: Request, res: Response) => {
    res.status(500).type("text/plain").send(`API failed to initialize:\n\n${message}\n`);
  });
}

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

// ALLOWED_ORIGINS validity is enforced centrally by validateProductionEnv()
// at startup; in production we only reach this point with a well-formed
// allowlist. In dev we silently drop malformed entries so a typo doesn't
// crash local runs.
const corsAllowlist: string[] = [];
for (const entry of rawAllowedOrigins) {
  try {
    const url = new URL(entry);
    if (url.protocol === "http:" || url.protocol === "https:") {
      corsAllowlist.push(entry);
    }
  } catch {
    // ignore: prod startup validator already rejected malformed entries
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
