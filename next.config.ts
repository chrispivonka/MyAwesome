import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These have native/optional binary deps (sharp, onnxruntime-node) that
  // Turbopack's bundler can fail to trace into the serverless output —
  // externalizing them makes Next.js copy the real installed files instead.
  serverExternalPackages: ["sharp", "@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
