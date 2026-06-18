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

type PublishError =
  | { kind: "not_found"; id: string }
  | { kind: "forbidden" }
  | { kind: "db"; cause: unknown };

// Compose async steps on a single typed error channel — no try/catch, no throws.
const publishPost = (id: string, user: User) =>
  tryAsync(db.posts.find(id), (cause): PublishError => ({ kind: "db", cause }))
    .flatMap((post) =>
      post ? ResultAsync.ok(post) : ResultAsync.err({ kind: "not_found", id }),
    )
    .flatMap((post) =>
      post.authorId === user.id
        ? ResultAsync.ok(post)
        : ResultAsync.err<Post, PublishError>({ kind: "forbidden" }),
    )
    .map((post) => ({ ...post, status: "published" as const }))
    .tapErr((e) => logger.warn("publish failed", e));

// Settle once; the compiler forces you to handle every branch.
const status = await publishPost(postId, user).match(
  () => 200,
  (e) => (e.kind === "not_found" ? 404 : e.kind === "forbidden" ? 403 : 500),
);`;

const PATTERN_SNIPPET = `import { match } from "@onrails/pattern";

type RemoteData =
  | { status: "idle" }
  | { status: "loading"; since: number }
  | { status: "ok"; rows: string[] }
  | { status: "error"; code: number };

// Exhaustive & type-narrowed — add a variant and every match stops compiling.
const render = (state: RemoteData) =>
  match(state)
    .with({ status: "idle" }, () => "Ready when you are")
    .with({ status: "loading" }, (s) => \`Loading… \${Date.now() - s.since}ms\`)
    .with({ status: "ok" }, (s) => \`\${s.rows.length} rows\`)
    .with({ status: "error" }, (s) => \`Error \${s.code}\`)
    .exhaustive();`;

const MAYBE_SNIPPET = `import { flatMap, fromNullable, map, match, unwrapOr } from "@onrails/maybe";

// Expected absence as a value — no scattered null checks, no optional-chaining soup.
const user = flatMap(fromNullable(raw.userId), (id) => fromNullable(users.get(id)));

const greeting = match(
  user,
  (u) => \`Welcome back, \${u.name}\`,
  () => "Welcome, guest",
);

// …or transform and collapse with a fallback in one line.
const displayName = unwrapOr(map(user, (u) => u.name.trim()), "guest");`;

const COMBINED_SNIPPET = `import { err, flatMap, match, ok } from "@onrails/result";
import { fromNullable } from "@onrails/maybe";
import { toResult } from "@onrails/maybe/interop";

type LoadError = { kind: "not_found"; id: string } | { kind: "inactive" };

// Maybe models absence; cross into Result at the boundary where it becomes a failure.
const loadActiveUser = (id: string) =>
  flatMap(
    toResult(fromNullable(users.get(id)), (): LoadError => ({ kind: "not_found", id })),
    (u) => (u.active ? ok(u) : err<User, LoadError>({ kind: "inactive" })),
  );

const banner = match(
  loadActiveUser("u_42"),
  (u) => \`Hi, \${u.name}\`,
  (e) => (e.kind === "not_found" ? "User not found" : "Account inactive"),
);`;

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
