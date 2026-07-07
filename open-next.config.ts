// Both packages have native binaries that Next's file tracing doesn't
// follow, since the missing pieces are OS-level dynamic-link dependencies
// (invisible to JS-level require/import analysis), not JS-reachable files:
//  - sharp: @huggingface/transformers unconditionally imports it from its
//    Node entry point (for image pipelines we never touch — we only do
//    text embeddings), and was missing entirely ("Cannot find package
//    'sharp'").
//  - onnxruntime-node: its N-API binding (.node) got traced fine, but the
//    libonnxruntime.so.1 shared library it dlopens at runtime did not
//    ("libonnxruntime.so.1: cannot open shared object file").
// OpenNext's install option runs a real npm install of each package for
// the Lambda's actual target platform, which pulls every file rather than
// whatever partial subset static tracing found. Keep versions in sync
// with bun.lock. See next.config.ts's serverExternalPackages for the
// matching Next-side config.
const config = {
  default: {
    install: {
      packages: ["sharp@0.34.5", "onnxruntime-node@1.24.3"],
      arch: "x64",
      libc: "glibc",
    },
  },
};

export default config;
