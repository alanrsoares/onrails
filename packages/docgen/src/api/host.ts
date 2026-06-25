import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import ts from "typescript";
import type { ApiCompilerHost } from "./types.js";

export const defaultCompilerHost: ApiCompilerHost = {
  fileExists: (p) => existsSync(p),
  readFile: (p) => {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      return undefined;
    }
  },
  writeFile: (p, content) => writeFileSync(p, content, "utf-8"),
  mkdir: (p) => mkdirSync(p, { recursive: true }),
  mkdtemp: (prefix) => mkdtempSync(prefix),
  rm: (p) => rmSync(p, { recursive: true, force: true }),
  createProgram: (rootNames, options) => {
    const customHost = ts.createCompilerHost(options);
    return ts.createProgram(rootNames, options, customHost);
  },
};
