import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@glantri/shared", "@glantri/schemas", "@glantri/rules-engine"]
};

export default nextConfig;
