import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@glantri/auth",
    "@glantri/content",
    "@glantri/domain",
    "@glantri/rules-engine",
    "@glantri/schemas",
    "@glantri/shared"
  ]
};

export default nextConfig;
