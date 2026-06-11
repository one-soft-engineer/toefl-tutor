import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be reached through a Cloudflare quick tunnel
  // (used for remote/mobile testing). Dev-only; ignored in production.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
