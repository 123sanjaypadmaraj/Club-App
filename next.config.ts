import type { NextConfig } from "next";
import path from "node:path";
import { buildCsp } from "./src/lib/csp";

const isDev = process.env.NODE_ENV !== "production";
// Static CSP for public pages (no per-request nonce, so they stay cacheable). /dashboard and /login get a nonce CSP from src/proxy.ts instead.
const csp = buildCsp({ isDev });

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  poweredByHeader: false,
  async headers() {
    return [
      {
        // /dashboard and /login are excluded: the proxy sends them a stricter per-request nonce CSP
        source: "/((?!dashboard$|dashboard/|login$|login/).*)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // camera stays allowed for the QR scanner on the check-in console
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
      {
        // the ticket URL is a bearer secret: never leak it through Referer (later entry wins)
        source: "/ticket/:code*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        // signed-in pages and login screens hold personal data: keep them out of shared caches
        source: "/dashboard/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/login/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
