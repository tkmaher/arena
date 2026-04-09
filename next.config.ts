import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["cdn.are.na", "s3.amazonaws.com", "images.are.na", "d2w9rnfcy7mm78.cloudfront.net"],
  },
  output: "export"
};

export default nextConfig;
