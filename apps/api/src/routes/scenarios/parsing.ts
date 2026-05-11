export function parseId(params: unknown, key: string, label: string): string {
  const value =
    params && typeof params === "object" && key in params ? (params as Record<string, unknown>)[key] : undefined;

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

export function parseOptionalInteger(
  object: Record<string, unknown>,
  key: string
): number | undefined {
  const value = object[key];

  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer when provided.`);
  }

  return value;
}

export function parseBodyObject(body: unknown, label: string): Record<string, unknown> {
  if (!body || typeof body !== "object") {
    throw new Error(`${label} is required.`);
  }

  return body as Record<string, unknown>;
}

export function parseOptionalString(
  object: Record<string, unknown>,
  key: string
): string | undefined {
  const value = object[key];

  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string when provided.`);
  }

  return value;
}

export function parseRequiredString(
  object: Record<string, unknown>,
  key: string
): string {
  const value = object[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

export function parseOptionalNullableString(
  object: Record<string, unknown>,
  key: string
): string | null | undefined {
  const value = object[key];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string or null when provided.`);
  }

  return value;
}

export function parseOptionalBoolean(
  object: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = object[key];

  if (value == null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean when provided.`);
  }

  return value;
}
