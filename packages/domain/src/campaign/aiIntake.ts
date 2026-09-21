import { z } from "zod";
import { artifactKindSchema } from "./artifact";

/**
 * AI-assisted intake context — the documented semantic interchange format.
 *
 * The format carries only human/semantic facts that a person or an AI
 * assistant can state without inspecting the file. Glantri derives every
 * technical fact (SHA-256, MIME type, byte size, storage identity, database
 * identity) from the files themselves; the format has no place to supply one
 * and any attempt to do so is rejected by the strict object schemas below.
 *
 * Free text is retained as GM notes only. Nothing in this format is parsed
 * from prose into canonical structure.
 */
export const AI_INTAKE_PRODUCER = "glantri-app/ai-intake";
export const AI_INTAKE_FORMAT = "glantri-intake";
export const AI_INTAKE_FORMAT_VERSION = 1;
export const AI_INTAKE_MAX_ENTRIES = 50;

export const aiIntakeRepresentsSchema = z.enum(["item", "artifact"]);
export const aiIntakeVisibilitySchema = z.enum(["gm_private", "campaign"]);

export const aiIntakeEntrySchema = z
  .object({
    /** Exact name of the supplied file this entry describes. */
    filename: z.string().trim().min(1).max(300).optional(),
    /** GM-private notes. Retained verbatim; never parsed for structure. */
    gmNotes: z.string().trim().max(4000).optional(),
    /** Media kind of the file. Required whenever a file is named. */
    kind: artifactKindSchema.optional(),
    /** Player-facing description, used as the Artifact alt text. */
    playerDescription: z.string().trim().max(1000).optional(),
    /** Whether this describes a game-world object or pure reference media. */
    represents: aiIntakeRepresentsSchema,
    /** Human-readable reference to another object. Never resolved by guessing. */
    relatedTo: z.string().trim().min(1).max(200).optional(),
    /** Shared description of the object or the media. */
    description: z.string().trim().max(4000).optional(),
    suggestedVisibility: aiIntakeVisibilitySchema.optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    title: z.string().trim().min(1).max(200),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.represents === "artifact" && !entry.filename)
      ctx.addIssue({
        code: "custom",
        message: `“${entry.title}” is a pure Artifact, so it must name the file it represents.`,
      });
    if (entry.filename && !entry.kind)
      ctx.addIssue({
        code: "custom",
        message: `“${entry.title}” names a file, so it must state a kind (map, image, portrait, document or handout).`,
      });
  });

export const aiIntakeContextSchema = z
  .object({
    entries: z.array(aiIntakeEntrySchema).min(1).max(AI_INTAKE_MAX_ENTRIES),
    format: z.literal(AI_INTAKE_FORMAT),
    /** Free text kept as GM notes for the whole intake. */
    notes: z.string().trim().max(4000).optional(),
    version: z.literal(AI_INTAKE_FORMAT_VERSION),
  })
  .strict()
  .superRefine((context, ctx) => {
    const filenames = context.entries.flatMap((entry) =>
      entry.filename ? [entry.filename.toLowerCase()] : [],
    );
    if (new Set(filenames).size !== filenames.length)
      ctx.addIssue({ code: "custom", message: "Each file may be described by only one entry." });
    const titles = context.entries.map((entry) => normalizeIntakeLabel(entry.title));
    if (new Set(titles).size !== titles.length)
      ctx.addIssue({
        code: "custom",
        message: "Each entry needs its own title so relationships stay unambiguous.",
      });
  });

export type AiIntakeEntry = z.infer<typeof aiIntakeEntrySchema>;
export type AiIntakeContext = z.infer<typeof aiIntakeContextSchema>;
export type AiIntakeRepresents = z.infer<typeof aiIntakeRepresentsSchema>;
export type AiIntakeVisibility = z.infer<typeof aiIntakeVisibilitySchema>;

/** Names match only on an exact, case-insensitive, whitespace-normalized basis. */
export function normalizeIntakeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export interface AiIntakeParseFailure {
  ok: false;
  problems: string[];
}
export interface AiIntakeParseSuccess {
  ok: true;
  context: AiIntakeContext;
}

/**
 * Parses pasted or uploaded context. Anything malformed, partial or
 * internally inconsistent fails closed with the reasons made plain; nothing
 * is coerced or filled in on the author's behalf.
 */
export function parseAiIntakeContext(raw: string): AiIntakeParseFailure | AiIntakeParseSuccess {
  const text = raw.trim();
  if (!text)
    return { ok: false, problems: ["Paste the intake context, or choose a context file."] };
  if (text.length > 256 * 1024)
    return { ok: false, problems: ["The intake context is larger than 256 KiB."] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      problems: [
        "This is not valid JSON. A truncated or partly copied paste fails here rather than being guessed at.",
      ],
    };
  }
  const result = aiIntakeContextSchema.safeParse(parsed);
  if (!result.success)
    return {
      ok: false,
      problems: [
        ...new Set(result.error.issues.map((issue) => describeIntakeProblem(issue, parsed))),
      ],
    };
  return { ok: true, context: result.data };
}

/** What each documented field may say, in the GM's own vocabulary. */
const intakeFieldExpectation: Record<string, string> = {
  description: "plain text",
  filename: "the exact name of one of the chosen files",
  gmNotes: "plain text",
  kind: "one of map, image, portrait, document or handout",
  playerDescription: "plain text",
  relatedTo: "the plain name of another described object",
  represents: "either “item” for a physical game-world object or “artifact” for reference media",
  suggestedVisibility: "either “gm_private” or “campaign”",
  tags: "a list of short plain-text tags",
  title: "a name",
};

const NOT_THE_DOCUMENTED_FORMAT =
  "This is not a Glantri intake context, or it was written for a different version of the format. Ask for the documented format again and paste the whole reply.";

function intakeEntryLabel(parsed: unknown, index: number): string {
  const entries = (parsed as { entries?: unknown } | null)?.entries;
  const entry = Array.isArray(entries) ? entries[index] : undefined;
  const title =
    entry && typeof entry === "object" ? (entry as { title?: unknown }).title : undefined;
  return typeof title === "string" && title.trim() ? `“${title.trim()}”` : `Entry ${index + 1}`;
}

function quotedList(values: readonly PropertyKey[]): string {
  const quoted = values.map((value) => `“${String(value)}”`);
  if (quoted.length <= 1) return quoted[0] ?? "";
  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
}

/**
 * Restates a schema rejection in the language of the documented intake format.
 * Raw validation output names paths, literals and internal types that belong to
 * the implementation, so it is never shown to the GM.
 */
function describeIntakeProblem(issue: z.ZodIssue, parsed: unknown): string {
  const [head, index, field] = issue.path;

  if (head === "format" || head === "version") return NOT_THE_DOCUMENTED_FORMAT;

  if (head !== "entries")
    return issue.code === "custom" ? issue.message : NOT_THE_DOCUMENTED_FORMAT;

  if (typeof index !== "number") {
    if (issue.code === "custom") return issue.message;
    if (issue.code === "too_big")
      return `One intake context may describe at most ${AI_INTAKE_MAX_ENTRIES} objects. Keep the rest for another intake.`;
    return "The intake context must list at least one described object under “entries”.";
  }

  const who = intakeEntryLabel(parsed, index);

  if (issue.code === "unrecognized_keys")
    return `${who} carries ${quotedList(issue.keys)}, which the intake format does not define. Describe only the documented facts — Glantri derives every technical fact from the files itself.`;

  if (issue.code === "custom") return issue.message;

  if (typeof field !== "string")
    return `${who} is not shaped like a described object. Ask for the documented format again.`;

  const expectation = intakeFieldExpectation[field] ?? "the documented value";

  if (issue.code === "too_big")
    return `${who} gives a “${field}” that is longer than Glantri accepts. Shorten it.`;

  if (issue.code === "invalid_type" && issue.received === "undefined")
    return `${who} is missing “${field}”, which must be ${expectation}.`;

  return `${who} gives a “${field}” Glantri cannot use. It must be ${expectation}.`;
}

/**
 * GM-authored prose about the described object itself. This is what reaches the
 * object's own GM-private notes; it never carries intake scaffolding, because
 * suggestions about how to file the result are not part of the game world.
 */
export function aiIntakeObjectGmNotes(
  entry: AiIntakeEntry,
  contextNotes: string | undefined,
): string | undefined {
  const lines = [entry.gmNotes, contextNotes].filter((line): line is string => Boolean(line));
  return lines.length ? lines.join("\n\n") : undefined;
}

/**
 * Suggestions that concern the Artifact representation rather than the object:
 * how the GM might file and share the media. They stay an Artifact concern and
 * are never written to an Item.
 */
export function aiIntakeArtifactSuggestionNotes(entry: AiIntakeEntry): string | undefined {
  const lines = [
    entry.tags?.length ? `Suggested tags: ${entry.tags.join(", ")}` : undefined,
    entry.suggestedVisibility
      ? `Suggested visibility: ${entry.suggestedVisibility === "campaign" ? "campaign" : "GM private"} (new material is always created GM-private; share it afterwards).`
      : undefined,
  ].filter((line): line is string => Boolean(line));
  return lines.length ? lines.join("\n\n") : undefined;
}

/** Everything a pure Artifact entry retains as its GM-private notes. */
export function aiIntakeGmNotes(
  entry: AiIntakeEntry,
  contextNotes: string | undefined,
): string | undefined {
  const lines = [
    entry.gmNotes,
    aiIntakeArtifactSuggestionNotes(entry),
    contextNotes ? `Intake notes: ${contextNotes}` : undefined,
  ].filter((line): line is string => Boolean(line));
  return lines.length ? lines.join("\n\n") : undefined;
}

/** The copyable instruction block the GM hands to an AI assistant. */
export const AI_INTAKE_FORMAT_INSTRUCTIONS = `Reply with one JSON object in this exact shape and nothing else.
Describe only human and semantic facts. Do not supply checksums, MIME types,
identifiers, paths or any other technical metadata — Glantri derives those itself.

{
  "format": "glantri-intake",
  "version": 1,
  "notes": "optional free text kept as GM notes",
  "entries": [
    {
      "represents": "item",
      "filename": "torn-treasure-map.png",
      "title": "Torn Treasure Map",
      "kind": "map",
      "description": "A salt-stained half of a sea chart.",
      "gmNotes": "The missing half is held by the harbourmaster.",
      "playerDescription": "A torn, salt-stained sea chart.",
      "suggestedVisibility": "gm_private",
      "tags": ["clue", "harbour"],
      "relatedTo": "Captain Varro"
    }
  ]
}

Field rules:
- "represents": "item" for a physical game-world object (weapon, letter, physical map,
  valuable); "artifact" for pure reference media (a portrait, a GM tactical map, a handout).
- "filename": the exact name of a file supplied alongside. Required for "artifact".
  An "item" may be described without a file.
- "kind": one of map, image, portrait, document, handout. Required whenever a file is named.
- "description" is player-visible. "gmNotes" is GM-private and never shown to players.
- "playerDescription" becomes the Artifact alt text.
- "relatedTo": the plain name of another object. Glantri proposes a link only when the
  name matches exactly one candidate; otherwise it asks the GM to bind it.
- Every field except "represents" and "title" is optional.`;
