import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const basePath = process.env.GITHUB_PAGES ? '/onrails' : '';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export',
  basePath,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  transpilePackages: [
    "@onrails/result",
    "@onrails/maybe",
    "@onrails/pattern"
  ],
  // twoslash + its VFS do dynamic fs/module access that the bundler can't
  // statically resolve; keep them external so they run as plain Node at
  // prerender (used by components/twoslash-snippet.tsx).
  serverExternalPackages: ["twoslash", "typescript", "@typescript/vfs"],
};

export default withMDX(config);
