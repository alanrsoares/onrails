import { highlight } from "fumadocs-core/highlight";
import { transformerTwoslash } from "fumadocs-twoslash";
import { Popup, PopupContent, PopupTrigger } from "fumadocs-twoslash/ui";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { twoslashCompilerOptions } from "@/lib/twoslash";

/**
 * Server-renders a twoslash snippet (compiled against the real @onrails/* source)
 * with hover lenses — for use outside MDX, e.g. the landing-page tabs. The input
 * is the `twoslash` form from lib/snippets.generated.ts.
 */
export async function TwoslashSnippet({ code }: { code: string }) {
  return highlight(code, {
    lang: "ts",
    themes: { light: "github-light", dark: "github-dark" },
    transformers: [
      transformerTwoslash({
        explicitTrigger: false,
        twoslashOptions: { compilerOptions: twoslashCompilerOptions },
      }),
    ],
    components: {
      pre: (props) => (
        <CodeBlock {...props}>
          <Pre>{props.children}</Pre>
        </CodeBlock>
      ),
      Popup,
      PopupContent,
      PopupTrigger,
    },
  });
}
