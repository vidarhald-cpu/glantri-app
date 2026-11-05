/**
 * The one home of the Playwright suite's target addresses (Forgejo #966).
 *
 * Ports 3000 and 4000 are the Product Owner's live Alpha stack. `globalSetup` runs before any spec
 * module loads and registers accounts and creates campaigns, scenarios, characters and roster
 * entries through the real API, so a run that fell back to those ports wrote into live data. There
 * is therefore **no default** here and none anywhere else: every spec, config and setup module
 * imports its targets from this file, which fails closed.
 *
 * Two refusals, both thrown at import time:
 *
 * 1. A required variable that is unset or empty.
 * 2. A target on port 3000 or 4000, **whatever the host**. This is a port rule, not a list of
 *    host spellings: a denylist of `localhost`, `127.x.x.x` and `0.0.0.0` fails open for a LAN
 *    address such as `http://192.168.1.50:4000`, which is the same live stack reached from another
 *    machine. A task stack derived by `pnpm db:task:e2e` never uses those ports.
 *
 * The one exemption is the repository's own CI job, whose isolated runner serves the web and API
 * containers on 3000 and 4000 and sets all three variables explicitly in the workflow. It is
 * recognised by two signals that no developer shell sets: `CI` and the job-level
 * `CI_SERVICE_STATE_DIR` that `.github/workflows/ci.yml` declares for that job.
 */

const LIVE_ALPHA_PORTS: ReadonlySet<string> = new Set(["3000", "4000"]);

const REQUIRED_VARIABLES = [
  "PLAYWRIGHT_API_URL",
  "PLAYWRIGHT_BASE_URL",
  "PLAYWRIGHT_BROWSER_API_URL",
] as const;

type TargetVariable = (typeof REQUIRED_VARIABLES)[number];

export type TargetEnvironment = Readonly<Record<string, string | undefined>>;

export interface PlaywrightTargets {
  readonly API_URL: string;
  readonly BROWSER_API_URL: string;
  readonly WEB_URL: string;
}

function isRepositoryCiJob(environment: TargetEnvironment): boolean {
  return Boolean(environment.CI) && Boolean(environment.CI_SERVICE_STATE_DIR);
}

function requireTarget(
  name: TargetVariable,
  environment: TargetEnvironment,
  allowLivePorts: boolean,
): string {
  const value = environment[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `${name} is required and is not set. The defaults were removed because they pointed at ` +
        "the live Alpha stack on ports 3000 and 4000, and the suite's globalSetup writes accounts " +
        "and campaigns through the real API. Run the suite through `pnpm db:task:e2e`, which " +
        "derives this worktree's own disposable stack and sets all three variables.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL: ${value}`);
  }

  if (!allowLivePorts && LIVE_ALPHA_PORTS.has(parsed.port)) {
    throw new Error(
      `${name}=${value} targets port ${parsed.port} on host ${parsed.hostname}. Ports 3000 and ` +
        "4000 are the live Alpha stack and are refused on every host, loopback or not, because " +
        "this suite writes to a real database. Run the suite through `pnpm db:task:e2e`, which " +
        "derives per-worktree ports.",
    );
  }

  return value;
}

/** Resolves and validates all three targets from `environment`; throws on the first refusal. */
export function resolvePlaywrightTargets(
  environment: TargetEnvironment = process.env,
): PlaywrightTargets {
  const allowLivePorts = isRepositoryCiJob(environment);
  const [api, base, browserApi] = REQUIRED_VARIABLES.map((name) =>
    requireTarget(name, environment, allowLivePorts),
  );
  return {
    API_URL: api as string,
    BROWSER_API_URL: browserApi as string,
    WEB_URL: base as string,
  };
}

const targets = resolvePlaywrightTargets();

export const API_URL = targets.API_URL;
export const BROWSER_API_URL = targets.BROWSER_API_URL;
export const WEB_URL = targets.WEB_URL;
