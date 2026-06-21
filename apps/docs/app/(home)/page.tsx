import { ArrowRight, Layers, ShieldCheck, Workflow, Zap } from "lucide-react";
import Link from "next/link";
import { CodeTabs } from "@/components/code-tabs";
import { TwoslashSnippet } from "@/components/twoslash-snippet";
import { snippets } from "@/lib/snippets.generated";
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

// Each tab's code is the live source of a type-checked, tested module in
// @onrails/examples (see lib/snippets.generated.ts), rendered through twoslash
// so tokens carry hover types.
const examples = [
  { id: "result", filename: "result.ts" },
  { id: "pattern", filename: "pattern.ts" },
  { id: "maybe", filename: "maybe.ts" },
  { id: "railway", filename: "railway.ts" },
  { id: "combined", filename: "combined.ts" },
] as const;

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4">
      {/* hero */}
      <section className="flex w-full max-w-5xl flex-col items-center pt-20 pb-16 text-center sm:pt-28">
        <span className="mb-5 rounded-full border border-fd-border bg-fd-secondary/60 px-3 py-1 text-xs font-medium tracking-wide text-fd-muted-foreground">
          railway-oriented · zero-any · functional-typescript
        </span>
        <h1 className="bg-linear-to-b from-fd-foreground to-fd-foreground/60 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-7xl">
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

      {/* code sample — file tabs live in the browser chrome bar; each panel is
          sourced from a type-checked @onrails/examples module */}
      <section className="w-full max-w-3xl pb-20 text-left">
        <CodeTabs
          tabs={examples.map(({ id, filename }) => ({ label: id, filename }))}
        >
          {examples.map(({ id }) => (
            <TwoslashSnippet key={id} code={snippets[id].twoslash} />
          ))}
        </CodeTabs>
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
