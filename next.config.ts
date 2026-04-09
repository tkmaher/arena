import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL("cdn.are.na"), new URL("s3-us-west-2.amazonaws.com/arena-attachments"),
    new URL("cdn.are.na"), new URL("s3-us-west-2.amazonaws.com/arena-attachments")],
    unoptimized: true,
  },
  output: "export"
  
};

export default nextConfig;
