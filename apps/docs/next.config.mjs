import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    "@onrails/result",
    "@onrails/maybe",
    "@onrails/pattern"
  ],
};

export default withMDX(config);
