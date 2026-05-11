import path from "node:path";
import type { NextConfig } from "next";

const outputMode =
  process.env.NEXT_OUTPUT_MODE ?? (process.platform === "win32" ? undefined : "standalone");

const nextConfig: NextConfig = {
  ...(outputMode ? { output: outputMode as NextConfig["output"] } : {}),
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@glantri/auth",
    "@glantri/content",
    "@glantri/domain",
    "@glantri/rules-engine",
    "@glantri/shared"
  ],
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.join(__dirname, "src")
    };

    return config;
  }
};

export default {
  ...nextConfig,
  eslint: {
    ignoreDuringBuilds: true
  }
};
