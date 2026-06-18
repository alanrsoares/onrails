export type Mode = "compat" | "native" | "tersify";
export type Args = { target: string; dry: boolean; onrails: string; mode: Mode };

export type Warning = { line: number; label: string; text: string };
export type FileChange = {
  path: string;
  before: number;
  after: number;
  changed: boolean;
  warnings: readonly Warning[];
};
export type Edit = { start: number; end: number; text: string; imports: readonly string[] };
export type ChainStep = { method: string; argsText: string; argCount: number };
export type PipelinePart = { importName: string; text: string };

export type ComputedChange = {
  next: string;
  before: number;
  after: number;
  changed: boolean;
  warnings: readonly Warning[];
};

export type ModeStrategy = {
  countBefore: (src: string) => number;
  earlyExit: (src: string, before: number) => boolean;
  transform: (src: string) => string;
  warnings: (next: string) => readonly Warning[];
  countAfter: (next: string) => number;
};

export type PkgChange = { path: string; removed: string[]; addedAs: string };
export type PkgUpdate = { json: Record<string, unknown>; removed: readonly string[] };
export type ComputedPkg = {
  json: Record<string, unknown>;
  removed: readonly string[];
  fileSpec: string;
};

export type ArgState = {
  positional: readonly string[];
  dry: boolean;
  mode: Mode;
  onrails: string;
};
export type EditAcc = { src: string; imports: Set<string> };
