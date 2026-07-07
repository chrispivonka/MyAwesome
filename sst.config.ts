/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "myawesome",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    const databaseUrl = new sst.Secret("DatabaseUrl");
    const githubClientId = new sst.Secret("GithubClientId");
    const githubClientSecret = new sst.Secret("GithubClientSecret");
    const authSecret = new sst.Secret("AuthSecret");
    const anthropicApiKey = new sst.Secret("AnthropicApiKey");

    const web = new sst.aws.Nextjs("MyAwesome", {
      environment: {
        DATABASE_URL: databaseUrl.value,
        GITHUB_CLIENT_ID: githubClientId.value,
        GITHUB_CLIENT_SECRET: githubClientSecret.value,
        AUTH_SECRET: authSecret.value,
        ANTHROPIC_API_KEY: anthropicApiKey.value,
      },
      // Defaults (20s / 1024MB) are plenty — the OAuth callback only does
      // a few Octokit calls + a DB write now. Profile *embedding* runs via
      // the daily-sync GitHub Actions workflow instead, not in this Lambda
      // (its native ONNX deps don't fit in Lambda's 250MB unzipped limit).
    });

    return {
      url: web.url,
    };
  },
});
