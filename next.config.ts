import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Hide the dev-tools badge: it renders as a dark circular button at the
  // bottom of the viewport and overlaps the mobile bottom-nav pill in dev
  // captures (docs/screenshots). Production is unaffected either way.
  devIndicators: false,
  reactStrictMode: false,
};

export default nextConfig;
