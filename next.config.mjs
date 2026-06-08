/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint is run separately; don't block production builds on it.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
