import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic();

// Cheapest current-gen model — combined with the Batch API (50% off) and
// prompt caching on the shared system prompt, this keeps the recurring
// ranking pass to a trivial cost. See Cost section of the project plan.
export const MODEL = "claude-haiku-4-5-20251001";

export interface RankCandidate {
  id: string;
  title: string;
  section: string;
  description: string;
}

export interface RankResult {
  id: string;
  score: number;
  category: string;
  rationale: string;
}

const SCORE_TOOL: Anthropic.Tool = {
  name: "score_items",
  description: "Submit relevance scores and rationales for the candidate items.",
  input_schema: {
    type: "object",
    properties: {
      scores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "The candidate item's id, copied exactly." },
            score: { type: "integer", description: "Relevance 0-100." },
            category: { type: "string", description: "A short category tag, e.g. 'CLI tool', 'self-hosted', 'language'." },
            rationale: { type: "string", description: "One punchy sentence on why this matters to this specific user." },
          },
          required: ["id", "score", "rationale"],
        },
      },
    },
    required: ["scores"],
  },
};

const SYSTEM_PROMPT = `You curate a personalized developer tools & tech discovery feed. Given a user's GitHub interest profile and a batch of candidate items pulled from GitHub "awesome list" READMEs, score how relevant each item is to that specific user (0-100) and write one punchy sentence explaining why it's relevant to *them* specifically — not a generic description of the tool. Tag each with a short category. Be selective: most items should score low; only genuinely interesting-to-them items should score above 70. Call the score_items tool with your results, one entry per candidate, using the exact id given.`;

export function buildBatchRequest(
  customId: string,
  profileText: string,
  candidates: RankCandidate[],
): Anthropic.Messages.Batches.BatchCreateParams["requests"][number] {
  return {
    custom_id: customId,
    params: {
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `User profile: ${
            profileText || "No profile signal yet — score generously based on general developer appeal."
          }\n\nCandidate items:\n${JSON.stringify(candidates)}`,
        },
      ],
      tools: [SCORE_TOOL],
      tool_choice: { type: "tool", name: "score_items" },
    },
  };
}

export function parseScoreResult(message: Anthropic.Message): RankResult[] {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "score_items",
  );
  if (!toolUse) return [];
  const input = toolUse.input as { scores?: RankResult[] };
  return input.scores ?? [];
}
