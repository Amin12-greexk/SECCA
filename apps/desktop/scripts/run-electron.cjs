const path = require("path");
const { spawn } = require("child_process");

let electronBinary;
try {
  electronBinary = require("electron");
} catch (error) {
  console.error("Electron dependency is missing. Run: pnpm install --filter desktop...");
  process.exit(1);
}

const appDir = path.resolve(__dirname, "..");
const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [appDir], {
  stdio: "inherit",
  shell: false,
  windowsHide: false,
  env: childEnv,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("Failed to start Electron:", error.message);
  process.exit(1);
});
