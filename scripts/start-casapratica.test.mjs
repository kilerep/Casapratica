import {readFile} from "node:fs/promises";
import {describe,expect,it} from "vitest";
import {buildWindowsProcessInvocation,resolvePackageManagerCommand,resolvePnpmViaNpxCommand} from "./package-manager-command.mjs";

describe("start:casapratica package manager launcher", () => {
  it("uses npx.cmd to run pnpm when pnpm is not globally installed on Windows", () => {
    expect(resolvePnpmViaNpxCommand({
      script: "dev",
      platform: "win32",
    })).toEqual({
      command: process.env.ComSpec || process.env.COMSPEC || "cmd.exe",
      args: ["/d", "/s", "/c", "npx.cmd pnpm@latest dev"],
    });
  });

  it("wraps Windows cmd shims without making quotes part of the executable name", () => {
    const invocation = buildWindowsProcessInvocation(
      "npx.cmd",
      ["pnpm@latest", "dev"],
      String.raw`C:\Windows\System32\cmd.exe`,
    );

    expect(invocation).toEqual({
      command: String.raw`C:\Windows\System32\cmd.exe`,
      args: ["/d", "/s", "/c", "npx.cmd pnpm@latest dev"],
    });
    expect(invocation.args[3]).not.toContain('"npx.cmd"');
  });

  it("uses npx to run pnpm on non-Windows systems", () => {
    expect(resolvePnpmViaNpxCommand({script: "dev", platform: "linux"})).toEqual({
      command: "npx",
      args: ["pnpm@latest", "dev"],
    });
  });

  it("runs npm scripts with `npm run`, never as a bare command", () => {
    const npm = String.raw`C:\Program Files\nodejs\npm.cmd`;
    const invocation = resolvePackageManagerCommand({
      npmExecPath: npm,
      script: "dev",
      packageManager: "npm",
      platform: "win32",
      commandInterpreter: String.raw`C:\Windows\System32\cmd.exe`,
    });

    expect(invocation.args).toEqual(["/d", "/s", "/c", `"${npm}" run dev`]);
    expect(invocation.args).not.toEqual(["dev"]);
  });

  it("runs a Windows executable directly, never through Node", () => {
    const pnpm = String.raw`C:\Users\user\AppData\Local\pnpm\pnpm.exe`;
    const invocation = resolvePackageManagerCommand({
      npmExecPath: pnpm,
      script: "dev",
      platform: "win32",
      nodeExecutable: String.raw`C:\Program Files\nodejs\node.exe`,
    });

    expect(invocation).toEqual({command: pnpm, args: ["dev"]});
    expect(invocation.command).not.toMatch(/node\.exe$/i);
  });

  it("runs a JavaScript package-manager entry point through Node", () => {
    const invocation = resolvePackageManagerCommand({
      npmExecPath: String.raw`C:\pnpm\pnpm.cjs`,
      script: "dev",
      platform: "win32",
      nodeExecutable: String.raw`C:\Program Files\nodejs\node.exe`,
    });

    expect(invocation).toEqual({
      command: String.raw`C:\Program Files\nodejs\node.exe`,
      args: [String.raw`C:\pnpm\pnpm.cjs`, "dev"],
    });
  });

  it("uses the Windows command interpreter explicitly for cmd shims", () => {
    const pnpm = String.raw`C:\Program Files\pnpm\pnpm.cmd`;
    const invocation = resolvePackageManagerCommand({
      npmExecPath: pnpm,
      script: "dev",
      platform: "win32",
      commandInterpreter: String.raw`C:\Windows\System32\cmd.exe`,
    });

    expect(invocation.command).toBe(String.raw`C:\Windows\System32\cmd.exe`);
    expect(invocation.args).toEqual(["/d", "/s", "/c", `"${pnpm}" dev`]);
  });

  it("runs the npm JavaScript launcher with `run dev`", () => {
    const npmCli = String.raw`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`;
    const node = String.raw`C:\Program Files\nodejs\node.exe`;

    expect(resolvePackageManagerCommand({
      npmExecPath: npmCli,
      script: "dev",
      platform: "win32",
      nodeExecutable: node,
    })).toEqual({command: node, args: [npmCli, "run", "dev"]});
  });

  it("starts Docker before invoking the dev script", async () => {
    const source = await readFile(new URL("./start-casapratica.mjs", import.meta.url), "utf8");
    const dockerStart = source.indexOf('"up","-d"');
    const devStart = source.indexOf('resolvePnpmViaNpxCommand({script:"dev"})');

    expect(dockerStart).toBeGreaterThan(-1);
    expect(devStart).toBeGreaterThan(dockerStart);
  });
});
