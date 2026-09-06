import path from "node:path";

const javascriptExtensions = new Set([".js", ".cjs", ".mjs"]);

const quoteWindowsArgument = value => /^[A-Za-z0-9_@./:\\-]+$/.test(value)
  ? value
  : `"${value.replaceAll('"', '""')}"`;

export function buildWindowsProcessInvocation(command, args, commandInterpreter = process.env.ComSpec || process.env.COMSPEC || "cmd.exe") {
  const commandLine = [command, ...args].map(quoteWindowsArgument).join(" ");
  return {command: commandInterpreter, args: ["/d", "/s", "/c", commandLine]};
}

export function resolvePnpmViaNpxCommand({
  script,
  platform = process.platform,
  npxExecutable = platform === "win32" ? "npx.cmd" : "npx",
}) {
  const args = ["pnpm@latest", script];
  return platform === "win32"
    ? buildWindowsProcessInvocation(npxExecutable, args)
    : {command: npxExecutable, args};
}

export function resolvePackageManagerCommand({
  npmExecPath,
  script,
  packageManager,
  platform = process.platform,
  nodeExecutable = process.execPath,
  commandInterpreter = process.env.ComSpec || process.env.COMSPEC || "cmd.exe",
}) {
  if (!npmExecPath) return null;

  const launcherName = path.basename(npmExecPath).toLowerCase();
  const manager = packageManager ?? (launcherName.startsWith("pnpm") ? "pnpm" : "npm");
  const args = manager === "npm" ? ["run", script] : [script];
  const extension = path.extname(npmExecPath).toLowerCase();
  if (javascriptExtensions.has(extension)) {
    return {command: nodeExecutable, args: [npmExecPath, ...args]};
  }

  if (platform === "win32" && (extension === ".cmd" || extension === ".bat")) {
    return buildWindowsProcessInvocation(npmExecPath, args, commandInterpreter);
  }

  return {command: npmExecPath, args};
}
