import { createSign, createHmac } from "crypto";

const APP_ID = process.env.GITHUB_APP_ID!;
const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";
const STATE_SECRET = process.env.NEXTAUTH_SECRET ?? "";

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

/**
 * Build a JWT for the GitHub App (RS256) for use as Bearer token when calling
 * GitHub App APIs (e.g. to get an installation access token).
 */
export function getAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 10 * 60,
    iss: APP_ID,
  };
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signatureInput);
  const signature = base64UrlEncode(sign.sign(PRIVATE_KEY));
  return `${signatureInput}.${signature}`;
}

/**
 * Get an installation access token for the given installation_id.
 * Use this token to call GitHub API on behalf of that installation (e.g. list repos).
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const jwt = getAppJwt();
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export type RepoItem = { name: string; full_name: string; html_url: string };

/**
 * List repositories accessible to the given installation.
 */
export async function listInstallationRepos(installationId: number): Promise<RepoItem[]> {
  const token = await getInstallationToken(installationId);
  const repos: RepoItem[] = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const res = await fetch(
      `https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      repositories?: Array<{ name?: string; full_name?: string; html_url?: string }>;
    };
    const list = data.repositories ?? [];
    for (const r of list) {
      if (r.full_name && r.html_url) {
        repos.push({
          name: r.name ?? r.full_name,
          full_name: r.full_name,
          html_url: r.html_url,
        });
      }
    }
    if (list.length < perPage) break;
    page += 1;
  }
  return repos;
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

/** Create state param for Install App URL: signed payload with user id. */
export function createInstallState(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 600;
  const payload = JSON.stringify({ userId, exp });
  const encoded = base64UrlEncode(Buffer.from(payload));
  const sig = createHmac("sha256", STATE_SECRET).update(encoded).digest();
  return `${encoded}.${base64UrlEncode(sig)}`;
}

/** Verify state from GitHub redirect; returns userId or null. */
export function verifyInstallState(state: string | null): string | null {
  if (!state?.includes(".")) return null;
  const [encoded, sigPart] = state.split(".");
  let payload: { userId?: string; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(base64UrlDecode(encoded)).toString());
  } catch {
    return null;
  }
  if (!payload.userId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000))
    return null;
  const expectedSig = createHmac("sha256", STATE_SECRET).update(encoded).digest();
  const sig = base64UrlDecode(sigPart);
  if (sig.length !== expectedSig.length || !expectedSig.equals(sig)) return null;
  return payload.userId;
}

/** Create short-lived token for /onboarding/github-app?token= (carries installation_id). */
export function createSetupToken(installationId: number): string {
  const exp = Math.floor(Date.now() / 1000) + 600;
  const payload = JSON.stringify({ installation_id: installationId, exp });
  const encoded = base64UrlEncode(Buffer.from(payload));
  const sig = createHmac("sha256", STATE_SECRET).update(encoded).digest();
  return `${encoded}.${base64UrlEncode(sig)}`;
}

/** Verify setup token; returns installation_id or null. */
export function verifySetupToken(token: string | null): number | null {
  if (!token?.includes(".")) return null;
  const [encoded, sigPart] = token.split(".");
  let payload: { installation_id?: number; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(base64UrlDecode(encoded)).toString());
  } catch {
    return null;
  }
  if (
    typeof payload.installation_id !== "number" ||
    !payload.exp ||
    payload.exp < Math.floor(Date.now() / 1000)
  )
    return null;
  const expectedSig = createHmac("sha256", STATE_SECRET).update(encoded).digest();
  const sig = base64UrlDecode(sigPart);
  if (sig.length !== expectedSig.length || !expectedSig.equals(sig)) return null;
  return payload.installation_id;
}
