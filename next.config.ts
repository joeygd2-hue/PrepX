import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Lets the end-to-end test server build into its own folder alongside a dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
