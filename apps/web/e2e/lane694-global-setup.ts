/**
 * Lane-scoped global setup for the #694 rendered proof.
 *
 * Identical in purpose to #690's: the ordinary `global-setup.ts` bootstraps a brand-new
 * game-master account, which fails against a database that has already been through
 * `pnpm db:task:seed` — the seeded game master already holds the role — after which every spec
 * dies on a 403. This setup only signs in as the seeded game master and stores that session,
 * because the subject of the proof is the shipped seed itself.
 */
import fs from "node:fs";
import path from "node:path";
import { API_URL, WEB_URL } from "./targets";

export const LANE694_STORAGE_STATE = "e2e/.auth/lane694-gm.json";

export default async function lane694GlobalSetup(): Promise<void> {
  console.log(`[lane694] api=${API_URL} web=${WEB_URL}`);
  const response = await fetch(`${API_URL}/auth/login`, {
    body: JSON.stringify({ email: "local-gm@example.com", password: "devpassword123" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`[lane694] seeded game-master login failed: ${response.status}`);
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
  const target = path.join(process.cwd(), LANE694_STORAGE_STATE);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(storageState, null, 2));
}
