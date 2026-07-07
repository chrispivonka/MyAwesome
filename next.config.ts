import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These have native/optional binary deps (sharp, onnxruntime-node) that
  // Turbopack's bundler can fail to trace into the serverless output —
  // externalizing them makes Next.js copy the real installed files instead.
  // Actually getting sharp's platform binary into the Lambda bundle is
  // handled by open-next.config.ts's `install` option (SST/OpenNext runs
  // its own separate bundling pass that doesn't read outputFileTracing*
  // from here).
  serverExternalPackages: ["sharp", "@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
