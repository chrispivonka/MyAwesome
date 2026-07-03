import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

// Runs fully locally via onnxruntime-node — no API key, no per-call cost,
// no rate limit. Dimension (384) must match EMBEDDING_DIMENSIONS in
// src/lib/db/schema.ts.
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

// Default cache dir lives under node_modules, which is read-only on Vercel's
// serverless filesystem — only /tmp is writable there. /tmp works fine
// locally and in GitHub Actions too, so this is safe everywhere.
env.cacheDir = "/tmp/transformers-cache";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_ID);
  }
  return extractorPromise;
}

export async function embed(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  return vector;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}
