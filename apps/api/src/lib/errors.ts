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

export function handleRouteError(error: unknown, reply: FastifyReply) {
  if (error instanceof NotFoundError) {
    return reply.code(404).send({ error: error.message });
  }
  if (error instanceof ConflictError) {
    return reply.code(409).send({ error: error.message });
  }
  if (error instanceof BadRequestError) {
    const body: Record<string, unknown> = { error: error.message };
    if (error.details !== undefined && typeof error.details === "object" && error.details !== null) {
      Object.assign(body, error.details);
    }
    return reply.code(400).send(body);
  }
  if (error instanceof Error) {
    return reply.code(400).send({ error: error.message });
  }
  throw error;
}
