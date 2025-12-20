import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow data URLs for base64 encoded images (photo/signature uploads)
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
