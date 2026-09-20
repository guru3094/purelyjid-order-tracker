import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/collections",
        destination: "/#collections",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
