import type { FastifyReply } from "fastify";

export class BadRequestError extends Error {
  readonly details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "BadRequestError";
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * Forgejo #1048: the one body an unexpected server-side failure may send to the client. It names no
 * cause, so no Prisma text, SQL, file path or stack can travel with it.
 */
export const CLIENT_SAFE_INTERNAL_ERROR_MESSAGE =
  "The server could not complete this request. Try again.";

/**
 * Forgejo #1048: whether a caught error is a persistence or unexpected internal failure rather than
 * a message the server deliberately addresses to the client.
 *
 * Plain `Error`s and `RangeError`s are the codebase's deliberate user-facing convention: services
 * and domain code throw them with messages that screens show, so they are not matched here. What is
 * matched is only what nothing in this codebase throws on purpose:
 * - every Prisma client error (`PrismaClientKnownRequestError`, `…UnknownRequestError`,
 *   `…ValidationError`, `…InitializationError`, `…RustPanicError`), whose message carries the query,
 *   the database's own text and, for a validation error, the server file path and source excerpt;
 * - `TypeError` and `ReferenceError`, which are programming defects;
 * - Node.js system errors (they carry `syscall`), whose message can carry a server file path.
 *
 * Matching is by `name` and shape so `apps/api` needs no dependency on `@prisma/client`.
 */
export function isInternalServerError(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  if (error.name.startsWith("PrismaClient")) return true;
  if (error instanceof TypeError || error instanceof ReferenceError) return true;
  return typeof (error as { syscall?: unknown }).syscall === "string";
}

/**
 * Forgejo #1048: answer an internal failure with the fixed client-safe body and a status that does
 * not blame the client. The full error, stack included, goes only to the server log.
 */
export function sendInternalServerError(error: unknown, reply: FastifyReply) {
  reply.log.error(
    { category: "api_route_internal_error", err: error },
    "API route failed with an internal error",
  );
  return reply.code(500).send({ error: CLIENT_SAFE_INTERNAL_ERROR_MESSAGE });
}

export function handleRouteError(error: unknown, reply: FastifyReply) {
  if (error instanceof NotFoundError) {
    return reply.code(404).send({ error: error.message });
  }
  if (error instanceof ConflictError) {
    return reply.code(409).send({ error: error.message });
  }
  if (error instanceof BadRequestError) {
    const body: Record<string, unknown> = { error: error.message };
    if (
      error.details !== undefined &&
      typeof error.details === "object" &&
      error.details !== null
    ) {
      Object.assign(body, error.details);
    }
    return reply.code(400).send(body);
  }
  if (isInternalServerError(error)) {
    return sendInternalServerError(error, reply);
  }
  if (error instanceof Error) {
    return reply.code(400).send({ error: error.message });
  }
  throw error;
}
