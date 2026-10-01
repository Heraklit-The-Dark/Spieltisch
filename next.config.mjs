/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["node-ical", "web-push"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};
export default nextConfig;
