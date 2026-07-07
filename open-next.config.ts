// @huggingface/transformers unconditionally imports `sharp` from its Node
// entry point (used only for image pipelines we never touch — we only do
// text embeddings). Next's own file tracing doesn't follow sharp's
// platform-conditional binary resolution, so the server function's Lambda
// bundle was missing it entirely ("Cannot find package 'sharp'" at
// runtime). This has OpenNext actually npm-install a real, correctly
// compiled build of sharp for the Lambda's target platform as part of
// bundling the server function — see next.config.ts's
// serverExternalPackages for the matching Next-side config.
const config = {
  default: {
    install: {
      packages: ["sharp@0.34.5"],
      arch: "x64",
      libc: "glibc",
    },
  },
};

export default config;
