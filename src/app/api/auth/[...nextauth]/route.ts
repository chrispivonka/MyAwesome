import { handlers } from "@/auth";

// The GitHub callback route triggers profile building (starred-repo fetch +
// local embedding inference) via after() on sign-in — give it more headroom
// than Vercel's default on a cold serverless start.
export const maxDuration = 60;

export const { GET, POST } = handlers;
