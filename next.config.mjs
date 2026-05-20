/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    /* @node-rs/argon2 is a native module — webpack can't bundle the `.node`
     * binary, so tell Next.js to require() it at runtime instead.
     * (Same idea for postgres-js, which lazy-loads platform-specific
     * driver code; safer to externalize both.) */
    serverComponentsExternalPackages: ["@node-rs/argon2", "postgres"],
  },
};

export default nextConfig;
