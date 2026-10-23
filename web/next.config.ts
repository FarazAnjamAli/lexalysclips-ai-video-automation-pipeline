import type { NextConfig } from "next";

// Production: `npm run build` writes a static site to web/out, which server.js serves on :4545.
// Development: `npm run dev` (port 3000) proxies the API/media to the running server on :4545.
const isProd = process.env.NODE_ENV === "production";
const BACKEND = process.env.RANKREEL_BACKEND || "http://127.0.0.1:4545";

const nextConfig: NextConfig = {
  ...(isProd ? { output: "export" as const } : {}),
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  ...(isProd
    ? {}
    : {
        async rewrites() {
          return [
            ...["api", "media", "thumbs", "output", "assets"].map((p) => ({
              source: `/${p}/:path*`,
              destination: `${BACKEND}/${p}/:path*`,
            })),
            { source: "/login", destination: `${BACKEND}/login` },
          ];
        },
      }),
};

export default nextConfig;
