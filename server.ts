import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import https from "https";

type Severity = "INFO" | "WARN" | "ERROR" | "FATAL";

interface StartupContext {
  basePath: string;
  logsDir: string;
  logFilePath: string;
  tempLogPath: string;
  fatalReportPath: string;
  logStream: fs.WriteStream | null;
  fallbackActive: boolean;
  startupStage: string;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message || String(error);
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function buildStartupContext(): StartupContext {
  const isBundled = path.basename(process.execPath).toLowerCase() !== "node" && path.basename(process.execPath).toLowerCase() !== "node.exe";
  const basePath = (process as any).pkg || isBundled ? path.dirname(process.execPath) : process.cwd();
  const logsDir = path.join(basePath, "Logs");
  const logFilePath = path.join(logsDir, "server.log");
  const tempLogPath = path.join(os.tmpdir(), `ietm-server-${process.pid}.log`);
  const fatalReportPath = path.join(logsDir, "server-fatal-report.log");

  return {
    basePath,
    logsDir,
    logFilePath,
    tempLogPath,
    fatalReportPath,
    logStream: null,
    fallbackActive: false,
    startupStage: "initializing"
  };
}

function installFatalHandlers(context: StartupContext) {
  const reportAndExit = (error: unknown, origin: string) => {
    const message = `Unhandled ${origin}: ${describeError(error)}`;
    writeLog(context, "FATAL", message);
    writeFatalReport(context, message, error, origin);
    setImmediate(() => process.exit(1));
  };

  process.on("uncaughtException", (error) => {
    reportAndExit(error, "uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    reportAndExit(reason, "unhandledRejection");
  });

  process.on("SIGTERM", () => {
    writeLog(context, "WARN", "Received SIGTERM; shutting down gracefully.");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    writeLog(context, "WARN", "Received SIGINT; shutting down gracefully.");
    process.exit(0);
  });
}

function writeLog(context: StartupContext, severity: Severity, message: string) {
  const line = `[${new Date().toISOString()}] ${severity}: ${message}`;
  const fallbackLine = `${line}\n`;

  if (!context.logStream || context.logStream.destroyed) {
    try {
      fs.appendFileSync(context.tempLogPath, fallbackLine, { encoding: "utf-8" });
    } catch {
      // Ignore fallback logging failures.
    }
  } else {
    try {
      context.logStream.write(fallbackLine);
      return;
    } catch {
      context.fallbackActive = true;
    }
  }

  try {
    if (severity === "FATAL" || severity === "ERROR") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  } catch {
    // Ignore console output failures.
  }

  try {
    fs.appendFileSync(context.tempLogPath, fallbackLine, { encoding: "utf-8" });
  } catch {
    // Ignore fallback logging failures.
  }
}

function initializeLogger(context: StartupContext) {
  try {
    if (!fs.existsSync(context.logsDir)) {
      fs.mkdirSync(context.logsDir, { recursive: true });
    }
    context.logStream = fs.createWriteStream(context.logFilePath, { flags: "a" });
    context.logStream.on("error", (error: Error) => {
      context.fallbackActive = true;
      writeLog(context, "WARN", `Primary log stream failed: ${describeError(error)}`);
    });
    writeLog(context, "INFO", `Logger initialized. logFile=${context.logFilePath}; tempLog=${context.tempLogPath}`);
  } catch (error) {
    context.fallbackActive = true;
    writeLog(context, "WARN", `Could not open primary log stream: ${describeError(error)}`);
  }
}

function logStartupState(context: StartupContext, stage: string) {
  context.startupStage = stage;
  writeLog(context, "INFO", `${stage} | execPath=${process.execPath} cwd=${process.cwd()} basePath=${context.basePath} NODE_ENV=${process.env.NODE_ENV || "<unset>"} platform=${process.platform} arch=${process.arch}`);
}

function ensureDirectory(context: StartupContext, targetPath: string, description: string) {
  if (fs.existsSync(targetPath)) {
    writeLog(context, "INFO", `${description} found at ${targetPath}`);
    return true;
  }

  try {
    fs.mkdirSync(targetPath, { recursive: true });
    writeLog(context, "WARN", `${description} was missing; created ${targetPath}`);
    return true;
  } catch (error) {
    writeLog(context, "ERROR", `${description} was missing and could not be created: ${describeError(error)} path=${targetPath}`);
    return false;
  }
}

function validateStartupPaths(context: StartupContext) {
  const checks = [
    { path: path.join(context.basePath, "Content"), description: "Content" },
    { path: path.join(context.basePath, "Content", "PDF"), description: "Content/PDF" },
    { path: path.join(context.basePath, "Content", "XML"), description: "Content/XML" },
    { path: path.join(context.basePath, "dist"), description: "dist" },
    { path: path.join(context.basePath, "dist", "index.html"), description: "dist/index.html" },
    { path: path.join(context.basePath, "config", "config.json"), description: "config/config.json" },
    { path: context.logsDir, description: "Logs" }
  ];

  for (const check of checks) {
    if (check.description === "config/config.json") {
      if (!fs.existsSync(check.path)) {
        writeLog(context, "WARN", `${check.description} was not found; continuing without it. path=${check.path}`);
      } else {
        writeLog(context, "INFO", `${check.description} found at ${check.path}`);
      }
      continue;
    }

    if (!fs.existsSync(check.path)) {
      writeLog(context, "WARN", `${check.description} was missing. path=${check.path}`);
    } else {
      writeLog(context, "INFO", `${check.description} found at ${check.path}`);
    }
  }

  ensureDirectory(context, context.logsDir, "Logs directory");
}

function writeFatalReport(context: StartupContext, message: string, error: unknown, origin: string) {
  try {
    const report = [
      `Timestamp: ${new Date().toISOString()}`,
      `Stage: ${context.startupStage}`,
      `Origin: ${origin}`,
      `execPath: ${process.execPath}`,
      `cwd: ${process.cwd()}`,
      `basePath: ${context.basePath}`,
      `NODE_ENV: ${process.env.NODE_ENV || "<unset>"}`,
      `platform: ${process.platform}`,
      `arch: ${process.arch}`,
      "",
      `Message: ${message}`,
      "",
      `Stack: ${describeError(error)}`
    ].join("\n");

    fs.appendFileSync(context.fatalReportPath, report + "\n\n", { encoding: "utf-8" });
    writeLog(context, "FATAL", `Fatal report written to ${context.fatalReportPath}`);
  } catch (reportError) {
    writeLog(context, "ERROR", `Failed to write fatal report: ${describeError(reportError)}`);
  }
}

async function startServer() {
  const context = buildStartupContext();
  installFatalHandlers(context);
  initializeLogger(context);

  try {
    logStartupState(context, "startup-begin");
    validateStartupPaths(context);

    const app = express();

    const PREFERRED_PORT = 3000;

    app.use(express.json());

    if (process.env.NODE_ENV !== "production") {
      app.post("/api/debug_log", (req, res) => {
        try {
          writeLog(context, "INFO", `[FRONTEND DEBUG] ${req.body?.message || "<empty>"}`);
          res.sendStatus(200);
        } catch (error) {
          writeLog(context, "ERROR", `Debug log endpoint failed: ${describeError(error)}`);
          res.sendStatus(500);
        }
      });
    }

    const contentPath = path.join(context.basePath, "Content");
    if (fs.existsSync(contentPath)) {
      app.use("/Content", express.static(contentPath, {
        setHeaders: (res) => {
          res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.set('Pragma', 'no-cache');
          res.set('Expires', '0');
          res.set('Surrogate-Control', 'no-store');
        }
      }));
      writeLog(context, "INFO", `Content static route enabled at /Content from ${contentPath} with cache disabled`);
    } else {
      writeLog(context, "WARN", `Content directory missing; /Content static route was not enabled. path=${contentPath}`);
    }

    if (process.env.NODE_ENV !== "production") {
      try {
        logStartupState(context, "starting-vite");
        const httpsOptions = {
          pfx: fs.readFileSync(path.join(context.basePath, "certificates", "server.pfx")),
          passphrase: "password"
        };
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { 
            middlewareMode: true,
            https: httpsOptions
          },
          appType: "spa"
        });
        app.use(vite.middlewares);
        writeLog(context, "INFO", "Vite middleware initialized.");
      } catch (error) {
        writeLog(context, "ERROR", `Vite initialization failed: ${describeError(error)}`);
        const fallbackIndexPath = path.join(context.basePath, "index.html");
        if (fs.existsSync(fallbackIndexPath)) {
          app.get("*", (req, res) => {
            try {
              res.sendFile(fallbackIndexPath);
            } catch (sendError) {
              writeLog(context, "ERROR", `Fallback index serving failed: ${describeError(sendError)}`);
              res.status(500).send("Unable to load index.html");
            }
          });
          writeLog(context, "WARN", `Falling back to root index.html at ${fallbackIndexPath}`);
        } else {
          writeLog(context, "WARN", `No fallback index.html exists at ${fallbackIndexPath}`);
        }
      }
    } else {
      const distPath = path.join(context.basePath, "dist");
      const distIndexPath = path.join(distPath, "index.html");
      const rootIndexPath = path.join(context.basePath, "index.html");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        try {
          if (fs.existsSync(distIndexPath)) {
            res.sendFile(distIndexPath);
            return;
          }
          if (fs.existsSync(rootIndexPath)) {
            writeLog(context, "WARN", `dist/index.html missing; using ${rootIndexPath}`);
            res.sendFile(rootIndexPath);
            return;
          }
          writeLog(context, "ERROR", `No index.html found for static fallback. dist=${distIndexPath} root=${rootIndexPath}`);
          res.status(404).send("index.html not found");
        } catch (error) {
          writeLog(context, "ERROR", `Static index fallback failed: ${describeError(error)}`);
          res.status(500).send("Unable to serve index.html");
        }
      });
    }

    logStartupState(context, "listening");

    let server: any;
    try {
      const httpsOptions = {
        pfx: fs.readFileSync(path.join(context.basePath, "certificates", "server.pfx")),
        passphrase: "password"
      };
      server = https.createServer(httpsOptions, app).listen(PREFERRED_PORT, "0.0.0.0", () => {
        try {
          const actualPort = (server.address() as any).port;
          writeLog(context, "INFO", `Server listening on https://0.0.0.0:${actualPort} (${process.env.NODE_ENV || "development"})`);
          const serverInfoPath = path.join(context.logsDir, "server.info");
          fs.writeFileSync(serverInfoPath, JSON.stringify({ port: actualPort }));
          writeLog(context, "INFO", `Wrote ${serverInfoPath}`);
        } catch (error) {
          writeLog(context, "ERROR", `Failed to write server.info: ${describeError(error)}`);
        }
      });
    } catch (error) {
      writeLog(context, "ERROR", `app.listen failed for preferred port ${PREFERRED_PORT}: ${describeError(error)}`);
      throw error;
    }

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        const msg = `Port ${PREFERRED_PORT} is already in use.\nPlease close the application using this port or configure a different port before starting IETM.`;
        writeLog(context, "FATAL", msg);
        writeFatalReport(context, msg, error, "listen");
        process.exit(1);
      } else {
        writeLog(context, "ERROR", `Server encountered a fatal listen error: ${describeError(error)}`);
        writeFatalReport(context, `Server encountered a fatal listen error: ${describeError(error)}`, error, "listen");
        process.exit(1);
      }
    });
  } catch (error) {
    writeLog(context, "ERROR", `Startup sequence failed: ${describeError(error)}`);
    writeFatalReport(context, `Startup sequence failed: ${describeError(error)}`, error, "startup");
    process.exit(1);
  }
}

startServer().catch((error) => {
  writeLog({
    basePath: process.cwd(),
    logsDir: path.join(process.cwd(), "Logs"),
    logFilePath: path.join(process.cwd(), "Logs", "server.log"),
    tempLogPath: path.join(os.tmpdir(), `ietm-server-${process.pid}.log`),
    fatalReportPath: path.join(process.cwd(), "Logs", "server-fatal-report.log"),
    logStream: null,
    fallbackActive: false,
    startupStage: "startup-failed"
  }, "FATAL", `startServer rejected: ${describeError(error)}`);
  process.exit(1);
});
