import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { ArrowRight, Layers, ShieldCheck, Workflow, Zap } from "lucide-react";
import Link from "next/link";
import { gitConfig } from "@/lib/shared";

const features = [
  {
    icon: Zap,
    title: "Railway-Oriented Programming",
    body: "Tame expected failure paths using type-safe Result, ResultAsync, and Maybe patterns without throwing exceptions across API boundaries.",
  },
  {
    icon: ShieldCheck,
    title: "Strict Type Inference",
    body: "Fully typed returns and errors. Compatible with TS strict options like noUncheckedIndexedAccess to guarantee robustness.",
  },
  {
    icon: Workflow,
    title: "Expressive Railway Flow",
    body: "Chain operations using functional composition: pipe, flow, or fluent builders. Write clean nested contexts via railway-do-notation.",
  },
  {
    icon: Layers,
    title: "No Runtime Bloat",
    body: "Zero external dependencies at runtime. Thin, pure TypeScript wrappers with maximum optimization and native interop.",
  },
];

const RESULT_SNIPPET = `import { ResultAsync, tryAsync } from "@onrails/result";

type FetchError =
  | { kind: "network"; cause: unknown }
  | { kind: "not_found" }
  | { kind: "decode"; issues: string[] };

// neverthrow-style: replace try/catch around fetch with one typed error channel.
const getUser = (id: string) =>
  tryAsync(fetch(\`/api/users/\${id}\`), (cause): FetchError => ({ kind: "network", cause }))
    .flatMap((res) =>
      res.ok
        ? ResultAsync.fromSafePromise(res.json())
        : ResultAsync.err<unknown, FetchError>({ kind: "not_found" }),
    )
    .flatMap((json) => decodeUser(json))   // a sync Result<User, FetchError> — accepted as-is
    .map((user) => user.displayName);

// Settle once; every error in the union is yours to handle.
const name = await getUser("u_42").unwrapOr("Anonymous");`;

const PATTERN_SNIPPET = `import { match } from "@onrails/pattern";

type Response =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ok"; posts: Post[] }
  | { status: "error"; code: number };

// ts-pattern-style: render a union to markup, exhaustively.
// Omit a case (or add a variant) and it stops compiling.
const view = (res: Response) =>
  match(res)
    .with({ status: "loading" }, () => \`<spinner />\`)
    .with({ status: "empty" }, () => \`<p>No posts yet</p>\`)
    .with({ status: "ok" }, (r) => \`<ul>\${r.posts.length} posts</ul>\`)
    .with({ status: "error" }, (r) => \`<p>Failed (\${r.code})</p>\`)
    .exhaustive();`;

const MAYBE_SNIPPET = `import { flatMap, fromNullable, map, unwrapOr } from "@onrails/maybe";

// fp-ts Option-style: walk nullable fields safely, then supply a default.
// No optional-chaining soup, no scattered null checks.
const city = flatMap(fromNullable(user.address), (addr) => fromNullable(addr.city));

const label = unwrapOr(
  map(city, (c) => c.name.toUpperCase()),
  "UNKNOWN",
);`;

const COMBINED_SNIPPET = `import { $, err, ok, tryGen } from "@onrails/result";
import { fromNullable } from "@onrails/maybe";
import { toResult } from "@onrails/maybe/interop";

type OrderError =
  | { kind: "no_user"; id: string }
  | { kind: "empty_cart" }
  | { kind: "payment"; code: string };

// Effect.gen-style do-notation: $ unwraps an Ok, or short-circuits the whole block.
// Maybe crosses into Result at the boundary where absence becomes a failure.
const placeOrder = (userId: string) =>
  tryGen(() => {
    const user = $(toResult(fromNullable(users.get(userId)), (): OrderError => ({ kind: "no_user", id: userId })));
    const cart = $(loadCart(user.id));                  // Result<Cart, OrderError>
    if (cart.items.length === 0) return err({ kind: "empty_cart" as const });
    const receipt = $(charge(user, cart.total));        // Result<Receipt, OrderError>
    return ok({ orderId: receipt.id, total: cart.total });
  });`;

const examples = [
  { label: "Result", code: RESULT_SNIPPET },
  { label: "Pattern", code: PATTERN_SNIPPET },
  { label: "Maybe", code: MAYBE_SNIPPET },
  { label: "Combined", code: COMBINED_SNIPPET },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4">
      {/* hero */}
      <section className="flex w-full max-w-5xl flex-col items-center pt-20 pb-16 text-center sm:pt-28">
        <span className="mb-5 rounded-full border border-fd-border bg-fd-secondary/60 px-3 py-1 text-xs font-medium tracking-wide text-fd-muted-foreground">
          railway-oriented · zero-any · functional-typescript
        </span>
        <h1 className="bg-gradient-to-b from-fd-foreground to-fd-foreground/60 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-7xl">
          onrails
        </h1>
        <p className="mt-5 max-w-2xl text-balance text-lg text-fd-muted-foreground sm:text-xl">
          A lightweight railway-oriented primitive set for TypeScript.
          Model fallible boundaries, map expected failures, and structure your workflows without exceptions.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-semibold text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-fd-accent"
          >
            Documentation
          </Link>
          <a
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-fd-accent"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* code sample — one tab per package */}
      <section className="w-full max-w-3xl pb-20 text-left">
        <Tabs items={examples.map((e) => e.label)}>
          {examples.map(({ label, code }) => (
            <Tab key={label} value={label}>
              <DynamicCodeBlock lang="ts" code={code} />
            </Tab>
          ))}
        </Tabs>
      </section>

      {/* features */}
      <section className="grid w-full max-w-5xl gap-4 pb-24 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-xl border border-fd-border bg-fd-card p-5 transition-colors hover:border-fd-primary/40"
          >
            <div className="mb-3 inline-flex rounded-lg bg-fd-primary/10 p-2 text-fd-primary">
              <Icon className="size-5" />
            </div>
            <h2 className="mb-1.5 font-semibold">{title}</h2>
            <p className="text-sm text-fd-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
