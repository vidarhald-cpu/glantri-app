/**
 * Lane-scoped global setup for the #690 rendered proof.
 *
 * The ordinary `global-setup.ts` cannot be used here: it bootstraps a brand-new game-master
 * account, and this proof has to run against a database that has already been through
 * `pnpm db:task:seed` — where the seeded game master already holds the role, so that bootstrap
 * fails and every spec then dies on a 403. This setup only signs in as the seeded game master and
 * stores that session, because the subject of the proof is the shipped seed itself.
 */
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:4000";
const WEB_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export const LANE690_STORAGE_STATE = "e2e/.auth/lane690-gm.json";

export default async function lane690GlobalSetup(): Promise<void> {
  console.log(`[lane690] api=${API_URL} web=${WEB_URL}`);
  const response = await fetch(`${API_URL}/auth/login`, {
    body: JSON.stringify({ email: "local-gm@example.com", password: "devpassword123" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`[lane690] seeded game-master login failed: ${response.status}`);
  }
  const header = response.headers.get("set-cookie") ?? "";
  const nameValue = (header.split(";")[0] ?? "").trim();
  const separator = nameValue.indexOf("=");
  const storageState = {
    cookies: [
      {
        domain: new URL(WEB_URL).hostname,
        expires: -1,
        httpOnly: true,
        name: nameValue.slice(0, separator).trim(),
        path: "/",
        sameSite: "Lax" as const,
        secure: false,
        value: nameValue.slice(separator + 1).trim(),
      },
    ],
    origins: [],
  };
  const target = path.join(process.cwd(), LANE690_STORAGE_STATE);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(storageState, null, 2));
}
