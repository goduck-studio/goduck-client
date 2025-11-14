import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Unity WebGL 파일을 위한 헤더 설정
  async headers() {
    return [
      {
        source: "/game/:path*",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
        ],
      },
      // .unityweb 파일을 위한 Content-Type 헤더
      {
        source: "/game/:path*.unityweb",
        headers: [
          {
            key: "Content-Type",
            value: "application/octet-stream",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
  // Unity WebGL 파일 확장자 지원
  webpack: (config, { isServer }) => {
    // 클라이언트 사이드에서만 적용
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  // Turbopack 설정 (Unity WebGL은 webpack 사용)
  turbopack: {},
};

export default nextConfig;
