import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "apps/web",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  {
    env: process.env,
    stdio: ["ignore", "inherit", "inherit"],
  },
);

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  child.kill();

  setTimeout(() => {
    process.exit(0);
  }, 1_000).unref();
}

child.on("exit", (code, signal) => {
  if (shuttingDown) {
    process.exit(0);
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGBREAK", shutdown);
