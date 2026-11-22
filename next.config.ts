import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // forbidden() + app/forbidden.tsx untuk halaman 403
  experimental: { authInterrupts: true },
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored:
          /([\\/]\.git[\\/]|[\\/]node_modules[\\/]|[\\/]docs[\\/]|[\\/]test-results[\\/]|[\\/]playwright-report[\\/])/,
      };
    }
    return config;
  },
};

export default nextConfig;
