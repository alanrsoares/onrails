import path from "node:path";
import { gzipSync } from "node:zlib";
import type { BundleRow } from "../harness.js";

const ENTRIES = [
  { id: "result-onrails", file: "result-onrails.ts" },
  { id: "result-neverthrow", file: "result-neverthrow.ts" },
  { id: "pattern-onrails", file: "pattern-onrails.ts" },
  { id: "pattern-ts-pattern", file: "pattern-ts-pattern.ts" },
] as const;

const entriesDir = path.join(import.meta.dir, "entries");

const measureOne = async (id: string, file: string): Promise<BundleRow> => {
  const entry = path.join(entriesDir, file);
  const result = await Bun.build({
    entrypoints: [entry],
    minify: true,
    target: "browser",
    format: "esm",
    // External nothing — we want the full import graph of the fair surface.
  });

  if (!result.success) {
    const msg = result.logs.map((l) => l.message).join("\n");
    throw new Error(`bundle failed for ${id}:\n${msg}`);
  }

  const artifact = result.outputs[0];
  if (!artifact) throw new Error(`bundle produced no output for ${id}`);
  const code = await artifact.text();
  const minifyBytes = Buffer.byteLength(code, "utf8");
  const gzipBytes = gzipSync(code).byteLength;
  return { id, minifyBytes, gzipBytes };
};

/** Minify + gzip each fair import-graph entry. */
export const measureBundles = async (): Promise<BundleRow[]> => {
  const rows: BundleRow[] = [];
  for (const { id, file } of ENTRIES) {
    rows.push(await measureOne(id, file));
  }
  return rows;
};
