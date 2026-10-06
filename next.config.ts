import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Version affichée dans l'en-tête (commit déployé par Vercel, sinon « dev »).
  env: {
    NEXT_PUBLIC_APP_VERSION: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
  },

  // Développement uniquement : autorise l'accès au serveur `npm run dev`
  // depuis l'iPad / l'iPhone via l'IP locale du PC (réseaux privés).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Aucune page n'a vocation à être affichée dans une iframe tierce.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
