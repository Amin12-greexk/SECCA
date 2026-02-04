const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

function parseEnvFile(filePath) {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function main() {
  const [, , envPath, ...cmdParts] = process.argv;
  if (!envPath || cmdParts.length === 0) {
    console.error("Usage: node scripts/run-with-env.js <envPath> <command>");
    process.exit(1);
  }

  const command = cmdParts.join(" ");
  const envVars = parseEnvFile(envPath);
  const child = spawn(command, {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ...envVars },
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

main();
