export function isLocalMode(): boolean {
  return process.env.LOCAL_MODE === "1";
}

export function getUploadToken(): string {
  const t = process.env.UPLOAD_TOKEN;
  if (!t) throw new Error("UPLOAD_TOKEN is not set");
  return t;
}

export function getResultsEndpoint(): string {
  const e = process.env.RESULTS_ENDPOINT;
  if (!e) throw new Error("RESULTS_ENDPOINT is not set");
  return e;
}

export function getAllowedGithubLogin(): string {
  const l = process.env.ALLOWED_GITHUB_LOGIN;
  if (!l) throw new Error("ALLOWED_GITHUB_LOGIN is not set");
  return l;
}
