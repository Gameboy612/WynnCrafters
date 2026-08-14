const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "WynnDB";
const isUserPagesRepository = repositoryName.endsWith(".github.io");
const configuredBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (isGithubActions && !isUserPagesRepository ? `/${repositoryName}` : "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  agentRules: false,
  images: {
    unoptimized: true
  },
  trailingSlash: true,
  basePath: configuredBasePath,
  assetPrefix: configuredBasePath ? `${configuredBasePath}/` : ""
};

export default nextConfig;
