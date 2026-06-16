export function isLocalMode(): boolean {
  return process.env.LOCAL_MODE === "1";
}

export function getAllowedGithubLogins(): string[] {
  const l = process.env.ALLOWED_GITHUB_LOGIN;
  if (!l) throw new Error("ALLOWED_GITHUB_LOGIN is not set");
  // Comma-separated list of allowed usernames, e.g. "alice,bob".
  const logins = l
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (logins.length === 0) throw new Error("ALLOWED_GITHUB_LOGIN is empty");
  return logins;
}

export function isGithubLoginAllowed(login: string | undefined | null): boolean {
  if (!login) return false;
  return getAllowedGithubLogins().includes(login.toLowerCase());
}
