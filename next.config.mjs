/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Ensure we can use local images/assets if needed
    images: {
        unoptimized: true,
    },
};

export default nextConfig;
