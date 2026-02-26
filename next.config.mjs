/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Ensure we can use local images/assets if needed
    images: {
        unoptimized: true,
    },
    // Ignore ESLint errors during build to allow deployment of legacy components
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
