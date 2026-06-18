import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { type SnippetId, snippets } from "@/lib/snippets.generated";

/**
 * Renders a documentation snippet by id. The source lives in `@onrails/examples`
 * as a real, type-checked, unit-tested module — so what's shown here is
 * guaranteed to compile against the published API.
 */
export function Snippet({ id, lang = "ts" }: { id: SnippetId; lang?: string }) {
  return <DynamicCodeBlock lang={lang} code={snippets[id]} />;
}
