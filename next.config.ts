import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Développement uniquement : autorise l'accès au serveur `npm run dev`
  // depuis l'iPad / l'iPhone via l'IP locale du PC (réseaux privés).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
