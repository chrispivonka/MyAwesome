import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These have native/optional binary deps (sharp, onnxruntime-node) that
  // Turbopack's bundler can fail to trace into the serverless output —
  // externalizing them makes Next.js copy the real installed files instead.
  serverExternalPackages: ["sharp", "@huggingface/transformers", "onnxruntime-node"],
  // serverExternalPackages alone wasn't enough: sharp's own platform binary
  // package still got dropped from the server function's bundle (its
  // resolution is conditional on process.platform/arch, which file tracing
  // doesn't follow). Force it in explicitly — the Lambda runs linux/x64.
  outputFileTracingIncludes: {
    "*": [
      "node_modules/sharp/**/*",
      "node_modules/@img/sharp-linux-x64/**/*",
      "node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
