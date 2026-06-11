export function isLocalMode(): boolean {
  return process.env.LOCAL_MODE === "1";
}

export function getAllowedGithubLogin(): string {
  const l = process.env.ALLOWED_GITHUB_LOGIN;
  if (!l) throw new Error("ALLOWED_GITHUB_LOGIN is not set");
  return l;
}
