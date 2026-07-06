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
      server: {
        // The GitHub OAuth callback awaits profile building (starred-repo
        // fetch + local embedding inference) synchronously — give it
        // headroom. 60s is also CloudFront's hard cap without an AWS
        // support ticket, so there's no benefit going higher.
        timeout: "60 seconds",
        memory: "2048 MB",
      },
    });

    return {
      url: web.url,
    };
  },
});
