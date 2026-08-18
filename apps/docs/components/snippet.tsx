import { TwoslashSnippet } from "@/components/twoslash-snippet";
import { type SnippetId, snippets } from "@/lib/snippets.generated";

/**
 * Renders a documentation snippet by id, through twoslash, with hover types.
 * The source lives in `@onrails/examples` as a real, type-checked, unit-tested
 * module — so what's shown is guaranteed to compile against the published API.
 */
export const Snippet = ({ id }: { id: SnippetId }) => <TwoslashSnippet code={snippets[id].twoslash} />;
