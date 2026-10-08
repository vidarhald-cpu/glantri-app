import { z } from "zod";

/**
 * The construction kit for player-facing schemas, Forgejo issue #517 (privacy hardening, Tier 3).
 *
 * A player-facing schema names every field a player receives through it, at every level; it says
 * nothing about player output built without one, such as the combat history's open event fact
 * buckets (privacy Tier 4, #528). Tier 1 and Tier 2 enumerated the top levels and reused the
 * internal schema of each nested structure, so a field added to such a nested schema reached players
 * (Tier 2 floor QA, F1). Here a player-facing object reuses an internal field schema only when that
 * field cannot hold an object, so it cannot gain a field; a field that can is given its own
 * player-facing schema, enumerated the same way, all the way down.
 *
 * Both halves are enforced, not documented:
 *
 * - at compile time, a field may be marked `LEAF` (reused from the internal schema) only when its
 *   value type holds no object: primitives, enums, and arrays or records of them. Marking an object
 *   field `LEAF` is a type error;
 * - when the module loads, every other field must be built from player-facing objects only. A
 *   player-facing schema that reaches an internal object schema, an open `unknown`/`any`, a lazy or
 *   transforming schema, or an object that does not strip unknown keys throws, so every test and the
 *   server fail immediately rather than a player receiving it.
 *
 * Player-facing objects strip unknown keys, so parsing a value through one keeps the named fields and
 * nothing else, at every level. Each is branded, so an internal value is not assignable to it at any
 * level; the only ways to obtain one are parsing (which applies the allow-list) and a type assertion.
 *
 * The only open value a player-facing schema may contain is `TIER_4_OPEN_COMMAND_FACTS`, the command
 * `facts` record, whose contents the command projection enumerates at runtime until Tier 4.
 */

/** Marks a field a player-facing object reuses from its internal schema: one that holds no object. */
export const LEAF = "leaf" as const;
type Leaf = typeof LEAF;

type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsLeafMember<T> = T extends Primitive
  ? true
  : T extends readonly (infer Element)[]
    ? IsLeafValue<Element>
    : T extends object
      ? string extends keyof T
        ? IsLeafValue<T[string & keyof T]>
        : false
      : false;

/** Whether a value type holds no object at any depth (an index-signature record of leaves does not). */
export type IsLeafValue<T> =
  IsAny<T> extends true
    ? false
    : unknown extends T
      ? false
      : false extends (T extends unknown ? IsLeafMember<T> : never)
        ? false
        : true;

type FieldEntry<Field extends z.ZodTypeAny> =
  IsLeafValue<z.output<Field>> extends true ? Leaf | z.ZodTypeAny : z.ZodTypeAny;

/** The fields a player-facing object names: each `LEAF`, or a player-facing schema. */
export type PlayerFacingFields<Shape extends z.ZodRawShape> = {
  [Key in keyof Shape]?: FieldEntry<Shape[Key]>;
};

type ResolvedShape<Shape extends z.ZodRawShape, Fields> = {
  [Key in keyof Fields]: Fields[Key] extends Leaf
    ? Key extends keyof Shape
      ? Shape[Key]
      : never
    : Fields[Key] extends z.ZodTypeAny
      ? Fields[Key]
      : never;
};

type NoExtraFields<Fields, Shape> = {
  [Key in keyof Fields]: Key extends keyof Shape ? Fields[Key] : never;
};

export type PlayerFacingObjectSchema<Shape extends z.ZodRawShape = z.ZodRawShape> = z.ZodObject<
  Shape,
  "strip"
>;

const playerFacingObjects = new WeakSet<z.ZodTypeAny>();

/**
 * The command `facts` record: the one open value a player-facing schema may contain. Its contents are
 * enumerated per command type at runtime by the command projection; closing it is Tier 4.
 */
export const TIER_4_OPEN_COMMAND_FACTS = z.record(z.string(), z.unknown());

type WrapperDef = z.ZodTypeDef & {
  getter?: () => z.ZodTypeAny;
  innerType?: z.ZodTypeAny;
  schema?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
};

function describeSchema(schema: z.ZodTypeAny): string {
  return (schema._def as { typeName?: string }).typeName ?? schema.constructor.name;
}

/**
 * Why `schema` may not be reused as a leaf: `undefined` when it holds no object at any depth. A
 * refinement or preprocess keeps the output type of the schema it wraps; a transform does not, so it
 * is not a leaf.
 */
export function findLeafViolation(schema: z.ZodTypeAny, path = "$"): string | undefined {
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodCatch ||
    schema instanceof z.ZodReadonly
  ) {
    return findLeafViolation((schema._def as WrapperDef).innerType!, path);
  }
  if (schema instanceof z.ZodBranded) return findLeafViolation(schema.unwrap(), path);
  if (schema instanceof z.ZodEffects) {
    return schema._def.effect.type === "transform"
      ? `${path}: a transform is not a leaf`
      : findLeafViolation(schema.innerType(), path);
  }
  if (schema instanceof z.ZodArray) return findLeafViolation(schema.element, `${path}[]`);
  if (schema instanceof z.ZodSet) return findLeafViolation(schema._def.valueType, `${path}[]`);
  if (schema instanceof z.ZodRecord || schema instanceof z.ZodMap) {
    return findLeafViolation(schema._def.valueType, `${path}{}`);
  }
  if (schema instanceof z.ZodTuple) {
    return (schema.items as z.ZodTypeAny[])
      .map((item, index) => findLeafViolation(item, `${path}[${index}]`))
      .find(Boolean);
  }
  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
    return (schema.options as z.ZodTypeAny[])
      .map((option) => findLeafViolation(option, path))
      .find(Boolean);
  }
  if (schema instanceof z.ZodIntersection) {
    return findLeafViolation(schema._def.left, path) ?? findLeafViolation(schema._def.right, path);
  }
  if (
    schema instanceof z.ZodString ||
    schema instanceof z.ZodNumber ||
    schema instanceof z.ZodBoolean ||
    schema instanceof z.ZodBigInt ||
    schema instanceof z.ZodDate ||
    schema instanceof z.ZodSymbol ||
    schema instanceof z.ZodLiteral ||
    schema instanceof z.ZodEnum ||
    schema instanceof z.ZodNativeEnum ||
    schema instanceof z.ZodNull ||
    schema instanceof z.ZodUndefined ||
    schema instanceof z.ZodNever ||
    schema instanceof z.ZodVoid ||
    schema instanceof z.ZodNaN
  ) {
    return undefined;
  }
  return `${path}: ${describeSchema(schema)} is not a leaf`;
}

/**
 * Every place `schema` lets a value reach a player that no player-facing schema names: an internal
 * object schema, an open `unknown`/`any` (other than `TIER_4_OPEN_COMMAND_FACTS`), an object that does
 * not strip unknown keys, or a lazy or transforming schema whose output cannot be enumerated. Empty
 * when the schema is whole-path player-facing.
 */
export function findWholePathViolations(
  schema: z.ZodTypeAny,
  path = "$",
  seen = new Set<z.ZodTypeAny>(),
): string[] {
  if (seen.has(schema)) return [];
  seen.add(schema);
  if (schema === TIER_4_OPEN_COMMAND_FACTS) return [];
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodCatch ||
    schema instanceof z.ZodReadonly
  ) {
    return findWholePathViolations((schema._def as WrapperDef).innerType!, path, seen);
  }
  if (schema instanceof z.ZodBranded) return findWholePathViolations(schema.unwrap(), path, seen);
  if (schema instanceof z.ZodEffects) {
    return schema._def.effect.type === "transform"
      ? [`${path}: a transform's output is not enumerated`]
      : findWholePathViolations(schema.innerType(), path, seen);
  }
  if (schema instanceof z.ZodObject) {
    if (!playerFacingObjects.has(schema)) return [`${path}: an internal object schema`];
    if (schema._def.unknownKeys !== "strip") return [`${path}: does not strip unknown keys`];
    return Object.entries(schema.shape as z.ZodRawShape).flatMap(([key, field]) =>
      findWholePathViolations(field, `${path}.${key}`, seen),
    );
  }
  if (schema instanceof z.ZodArray)
    return findWholePathViolations(schema.element, `${path}[]`, seen);
  if (schema instanceof z.ZodSet) {
    return findWholePathViolations(schema._def.valueType, `${path}[]`, seen);
  }
  if (schema instanceof z.ZodRecord || schema instanceof z.ZodMap) {
    return findWholePathViolations(schema._def.valueType, `${path}{}`, seen);
  }
  if (schema instanceof z.ZodTuple) {
    return (schema.items as z.ZodTypeAny[]).flatMap((item, index) =>
      findWholePathViolations(item, `${path}[${index}]`, seen),
    );
  }
  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
    return (schema.options as z.ZodTypeAny[]).flatMap((option) =>
      findWholePathViolations(option, path, seen),
    );
  }
  if (schema instanceof z.ZodIntersection) {
    return [
      ...findWholePathViolations(schema._def.left, path, seen),
      ...findWholePathViolations(schema._def.right, path, seen),
    ];
  }
  const leafViolation = findLeafViolation(schema, path);
  return leafViolation ? [leafViolation] : [];
}

function buildPlayerFacingShape<Shape extends z.ZodRawShape>(
  name: string,
  internal: z.ZodObject<Shape, z.UnknownKeysParam>,
  fields: Record<string, Leaf | z.ZodTypeAny>,
): z.ZodRawShape {
  const internalShape = internal.shape as z.ZodRawShape;
  const shape: z.ZodRawShape = {};
  for (const [key, entry] of Object.entries(fields)) {
    if (!(key in internalShape)) {
      throw new Error(`Player-facing ${name}.${key} is not a field of its internal schema.`);
    }
    if (entry === LEAF) {
      const violation = findLeafViolation(internalShape[key]!, `${name}.${key}`);
      if (violation) {
        throw new Error(`Player-facing ${name}.${key} reuses an internal schema: ${violation}.`);
      }
      shape[key] = internalShape[key]!;
    } else {
      const violations = findWholePathViolations(entry, `${name}.${key}`);
      if (violations.length > 0) {
        throw new Error(
          `Player-facing ${name}.${key} is not whole-path: ${violations.join("; ")}.`,
        );
      }
      shape[key] = entry;
    }
  }
  return shape;
}

/**
 * A player-facing schema as other modules see it: a schema whose output is its branded player-facing
 * value. It is declared this way, rather than as the zod object it is, so that its emitted
 * declaration is that plain output type: as the full zod object type, every schema's declaration
 * would repeat all the zod generics of the schemas nested in it, and a package consuming those
 * declarations (`apps/api` builds against `dist`) could not compute its output (TS2589). The runtime
 * value is the branded zod object, so `unwrap()` reaches it.
 */
export interface PlayerFacingSchema<Output, Key extends string = string> extends z.ZodType<
  Output,
  z.ZodTypeDef,
  unknown
> {
  unwrap(): z.ZodObject<{ [Field in Key]: z.ZodTypeAny }>;
}

/**
 * A player-facing object: the named fields of `internal`, each reused (`LEAF`) or given a
 * player-facing schema, branded `name`. Fields not named are not part of it.
 */
export function playerFacingObject<
  Name extends string,
  Shape extends z.ZodRawShape,
  const Fields extends PlayerFacingFields<Shape>,
>(
  name: Name,
  internal: z.ZodObject<Shape, z.UnknownKeysParam>,
  fields: Fields & NoExtraFields<Fields, Shape>,
): PlayerFacingSchema<
  z.output<PlayerFacingObjectSchema<ResolvedShape<Shape, Fields>>> & z.BRAND<Name>,
  Extract<keyof Fields, string>
> {
  const object = z.object(
    buildPlayerFacingShape(name, internal, fields as Record<string, Leaf | z.ZodTypeAny>),
  );
  playerFacingObjects.add(object);
  return object.brand<Name>() as unknown as PlayerFacingSchema<
    z.output<PlayerFacingObjectSchema<ResolvedShape<Shape, Fields>>> & z.BRAND<Name>,
    Extract<keyof Fields, string>
  >;
}

/**
 * A player-facing variant of a discriminated union, unbranded because a discriminated union needs
 * plain objects; brand the union with `brandPlayerFacing`.
 */
export function playerFacingVariant<
  Shape extends z.ZodRawShape,
  const Fields extends PlayerFacingFields<Shape>,
>(
  name: string,
  internal: z.ZodObject<Shape, z.UnknownKeysParam>,
  fields: Fields & NoExtraFields<Fields, Shape>,
): PlayerFacingObjectSchema<ResolvedShape<Shape, Fields>> {
  const object = z.object(
    buildPlayerFacingShape(name, internal, fields as Record<string, Leaf | z.ZodTypeAny>),
  );
  playerFacingObjects.add(object);
  return object as unknown as PlayerFacingObjectSchema<ResolvedShape<Shape, Fields>>;
}

/**
 * Brands a player-facing union (or any whole-path player-facing schema) after checking it. Declared
 * by its branded output, like `PlayerFacingSchema`, for the same reason.
 */
export function brandPlayerFacing<Name extends string, Schema extends z.ZodTypeAny>(
  name: Name,
  schema: Schema,
): z.ZodType<z.output<Schema> & z.BRAND<Name>, z.ZodTypeDef, unknown> {
  const violations = findWholePathViolations(schema, name);
  if (violations.length > 0) {
    throw new Error(`Player-facing ${name} is not whole-path: ${violations.join("; ")}.`);
  }
  return schema.brand<Name>() as unknown as z.ZodType<
    z.output<Schema> & z.BRAND<Name>,
    z.ZodTypeDef,
    unknown
  >;
}

/**
 * Whether `schema` is an object built by `playerFacingObject`/`playerFacingVariant`. For tests and the
 * route harness, which walk player payloads against the player-facing types.
 */
export function isPlayerFacingObjectSchema(schema: z.ZodTypeAny): boolean {
  return playerFacingObjects.has(schema);
}

/** Per-viewer values for some fields of a player-facing object, replacing the source's. */
export type PlayerFacingOverrides<Schema extends z.ZodTypeAny> = {
  [Key in Exclude<keyof z.output<Schema>, typeof z.BRAND>]?: unknown;
};

/**
 * Builds a player-facing value additively: for each field the schema names — and only those — the
 * override when one is given for it, otherwise the same field of `source`; then parses the result,
 * which builds every nested value from its own player-facing schema. Neither `source` nor any nested
 * value is spread, so a field the schema does not name is never read.
 */
export function buildPlayerFacing<Schema extends z.ZodTypeAny>(
  schema: Schema,
  source: object,
  overrides: PlayerFacingOverrides<Schema> = {},
): z.output<Schema> {
  let object: z.ZodTypeAny = schema;
  while (object instanceof z.ZodBranded) object = object.unwrap();
  if (!(object instanceof z.ZodObject) || !playerFacingObjects.has(object)) {
    throw new Error("buildPlayerFacing needs a player-facing object schema.");
  }
  const values = source as Record<string, unknown>;
  const named = overrides as Record<string, unknown>;
  const input: Record<string, unknown> = {};
  for (const key of Object.keys(object.shape as z.ZodRawShape)) {
    const value = Object.hasOwn(named, key) ? named[key] : values[key];
    if (value !== undefined) input[key] = value;
  }
  return schema.parse(input);
}
