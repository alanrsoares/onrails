#!/usr/bin/env bun
import { run } from "mitata";
import { measureBundles } from "../src/bundle/measure.js";
import { registerPatternBenches } from "../src/cases/pattern.js";
import { registerResultBenches } from "../src/cases/result.js";
import {
  type BundleRow,
  collectMeta,
  flattenRuntimeRows,
  parseFlags,
  type RuntimeRow,
  renderResultsMarkdown,
  resultsMdPath,
  writeJson,
} from "../src/harness.js";

const flags = parseFlags(Bun.argv.slice(2));

const ensureDist = async (): Promise<void> => {
  const resultDist = Bun.file(new URL("../../result/dist/index.js", import.meta.url));
  const patternDist = Bun.file(new URL("../../pattern/dist/index.js", import.meta.url));
  if (!(await resultDist.exists()) || !(await patternDist.exists())) {
    throw new Error(
      "Missing packages/result or packages/pattern dist/. Run `bun run build` first.",
    );
  }
};

const runRuntime = async (): Promise<RuntimeRow[]> => {
  registerResultBenches();
  registerPatternBenches();
  const out = await run({
    throw: true,
    colors: !flags.ci,
    format: flags.ci ? "quiet" : "mitata",
  });
  return flattenRuntimeRows(out.benchmarks);
};

const main = async (): Promise<void> => {
  await ensureDist();
  const meta = await collectMeta();
  let runtime: RuntimeRow[] = [];
  let bundles: BundleRow[] = [];

  if (flags.runtime) {
    runtime = await runRuntime();
    const runtimePath = await writeJson("runtime.json", { meta, runtime });
    console.log(`wrote ${runtimePath}`);
  }

  if (flags.bundle) {
    bundles = await measureBundles();
    const bundlePath = await writeJson("bundle.json", { meta, bundles });
    console.log(`wrote ${bundlePath}`);
    for (const b of bundles) {
      console.log(`  ${b.id.padEnd(22)} minify=${b.minifyBytes} B  gzip=${b.gzipBytes} B`);
    }
  }

  if (flags.markdown) {
    if (runtime.length === 0 || bundles.length === 0) {
      throw new Error("--markdown needs both runtime and bundle (omit --runtime/--bundle filters)");
    }
    await Bun.write(resultsMdPath, renderResultsMarkdown(meta, runtime, bundles));
    console.log(`wrote ${resultsMdPath}`);
  }
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
