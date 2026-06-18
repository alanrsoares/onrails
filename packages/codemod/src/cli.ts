import { relative, resolve } from "node:path";
import * as Maybe from "@onrails/maybe";
import { match } from "@onrails/pattern";
import { err, isErr, ok, type Result, ResultAsync } from "@onrails/result";
import { Glob } from "bun";
import { CODE_EXT, SKIP } from "./constants.js";
import { computeFileChange, toFileChange } from "./file-change.js";
import { readFileText, writeFileText } from "./io.js";
import { rewritePkg } from "./pkg.js";
import type { ArgState, Args, FileChange, Mode, PkgChange } from "./types.js";

const ONRAILS_FLAG = "--onrails=";

const applyArg = (s: ArgState, a: string): ArgState =>
  match(a)
    .returnType<ArgState>()
    .withEither("--dry", "-n", () => ({ ...s, dry: true }))
    .with("--to-native", () => ({ ...s, mode: "native" }))
    .with("--tersify", () => ({ ...s, mode: "tersify" }))
    .with(
      (x) => x.startsWith(ONRAILS_FLAG),
      (x) => ({ ...s, onrails: resolve(x.slice(ONRAILS_FLAG.length)) }),
    )
    .with(
      (x) => !x.startsWith("--"),
      (x) => ({ ...s, positional: [...s.positional, x] }),
    )
    .otherwise(() => s);

const USAGE =
  "usage: onrails-codemod-neverthrow <target-dir> [--dry] [--to-native] [--tersify] [--onrails=<abs-path>]";

export function parseArgs(argv: string[]): Result<Args, string> {
  const initial: ArgState = {
    positional: [],
    dry: false,
    mode: "compat",
    onrails: resolve(import.meta.dir, "../../..", "packages/result"),
  };
  const { positional, dry, mode, onrails } = argv.reduce(applyArg, initial);
  if (positional.length !== 1) {
    return err(USAGE);
  }
  return ok({
    target: resolve(positional[0] ?? "."),
    dry,
    onrails,
    mode,
  });
}

const shouldSkip = (path: string) => path.split("/").some((seg) => SKIP.has(seg));

async function* walk(root: string): AsyncGenerator<string> {
  const glob = new Glob("**/*");
  for await (const rel of glob.scan({ cwd: root, dot: false, onlyFiles: true })) {
    if (!shouldSkip(rel)) yield `${root}/${rel}`;
  }
}

const rewriteCode = (
  path: string,
  dry: boolean,
  mode: Mode,
): ResultAsync<Maybe.Maybe<FileChange>, Error> =>
  readFileText(path).flatMap((src) =>
    Maybe.match(
      computeFileChange(src, mode),
      (c) => {
        const change = toFileChange(path, c);
        return c.changed && !dry
          ? writeFileText(path, c.next).map(() => Maybe.some(change))
          : ResultAsync.ok<Maybe.Maybe<FileChange>, Error>(Maybe.some(change));
      },
      () => ResultAsync.ok<Maybe.Maybe<FileChange>, Error>(Maybe.none()),
    ),
  );

const collectInto =
  <T>(into: T[], file: string) =>
  (r: ResultAsync<Maybe.Maybe<T>, Error>): Promise<void> =>
    r.match(
      (m) => void Maybe.tap(m, (c) => into.push(c)),
      (e) => console.error(`error processing ${file}:`, e.message),
    );

const printReport = (
  { target, dry, onrails, mode }: Args,
  codeChanges: readonly FileChange[],
  pkgChanges: readonly PkgChange[],
): void => {
  const label = dry ? "DRY" : "APPLY";
  console.log(`[${label}] target=${target}`);
  console.log(`[${label}] mode=${mode}`);
  if (mode === "compat") console.log(`[${label}] onrails=${onrails}`);
  const changedCodeCount = codeChanges.filter((c) => c.changed).length;
  console.log(`[${label}] code files changed: ${changedCodeCount}`);
  if (mode === "native") {
    console.log(`[${label}] code files reported only: ${codeChanges.length - changedCodeCount}`);
  }
  for (const c of codeChanges) {
    console.log(`  ${relative(target, c.path)}  (${c.before} import${c.before === 1 ? "" : "s"})`);
    for (const warning of c.warnings) {
      console.log(`    TODO line ${warning.line}: ${warning.label}: ${warning.text}`);
    }
  }
  if (mode === "compat") {
    console.log(`[${label}] package.json updated: ${pkgChanges.length}`);
    for (const c of pkgChanges) {
      console.log(`  ${relative(target, c.path)}  [${c.removed.join(", ")}] -> ${c.addedAs}`);
    }
  }
  if (dry) console.log(`[${label}] no files written. re-run without --dry to apply.`);
};

export async function main() {
  const parsed = parseArgs(Bun.argv.slice(2));
  if (isErr(parsed)) {
    console.error(parsed.error);
    process.exit(2);
  }
  const args = parsed.value;
  const { target, dry, onrails, mode } = args;
  const codeChanges: FileChange[] = [];
  const pkgChanges: PkgChange[] = [];
  for await (const file of walk(target)) {
    if (mode === "compat" && file.endsWith("/package.json"))
      await collectInto(pkgChanges, file)(rewritePkg(file, onrails, dry));
    else if (CODE_EXT.test(file))
      await collectInto(codeChanges, file)(rewriteCode(file, dry, mode));
  }
  printReport(args, codeChanges, pkgChanges);
}
