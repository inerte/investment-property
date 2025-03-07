/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/investment-property" : "",
  images: {
    unoptimized: true,
  },
  // This is needed for GitHub Pages
  assetPrefix:
    process.env.NODE_ENV === "production" ? "/investment-property/" : "",
};

module.exports = nextConfig;
