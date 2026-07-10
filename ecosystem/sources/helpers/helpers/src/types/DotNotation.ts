type PathOptions<Obj, Key extends keyof Obj> = Key extends string
  ? Obj[Key] extends Record<any, any>
    ?
        | `${Key}.${PathOptions<Obj[Key], Exclude<keyof Obj[Key], keyof any[]>> & string}`
        | `${Key}.${Exclude<keyof Obj[Key], keyof any[]> & string}`
    : never
  : never;

type PathOptionsOrKey<Obj> = PathOptions<Obj, keyof Obj> | keyof Obj;

type OptionalField<Obj, Key> = PathValue<Exclude<Obj, undefined>, Key> | Extract<Obj, undefined>;

type IndexedField<Obj, Key> = Key extends keyof Obj
  ? Obj[Key]
  : Key extends `${number}`
    ? '0' extends keyof Obj
      ? undefined
      : number extends keyof Obj
        ? Obj[number]
        : undefined
    : undefined;

/**
 * Defines the union of all valid dot-notation paths within an object.
 *
 * Includes array index access via bracket notation (e.g. `'items[0].name'`).
 *
 * @template Obj - The object type to enumerate paths for.
 */
export type PathsOf<Obj> =
  PathOptionsOrKey<Obj> extends string | keyof Obj ? PathOptionsOrKey<Obj> | '' : keyof Obj | '';

/**
 * Retrieves the value type at a given dot-notation path within an object.
 *
 * Returns `undefined` when the path traverses through optional properties.
 *
 * @template Obj - The object type to traverse.
 * @template Path - A dot-notation path compatible with {@link PathsOf}.
 */
export type PathValue<Obj, Path> = Path extends ''
  ? Obj
  : Path extends `${infer Left}.${infer Right}`
    ? Left extends keyof Obj
      ? OptionalField<Obj[Left], Right>
      : Left extends `${infer FieldKey}[${infer IndexKey}]`
        ? FieldKey extends keyof Obj
          ? OptionalField<
              | IndexedField<Exclude<Obj[FieldKey], undefined>, IndexKey>
              | Extract<Obj[FieldKey], undefined>,
              Right
            >
          : undefined
        : undefined
    : Path extends keyof Obj
      ? Obj[Path]
      : Path extends `${infer FieldKey}[${infer IndexKey}]`
        ? FieldKey extends keyof Obj
          ?
              | IndexedField<Exclude<Obj[FieldKey], undefined>, IndexKey>
              | Extract<Obj[FieldKey], undefined>
          : undefined
        : undefined;

/**
 * Defines a union of `{path, value}` pairs for every path in an object.
 *
 * Useful for exhaustively iterating over all leaf values with their paths.
 *
 * @template Obj - The object type to enumerate.
 * @template Path - A specific path, defaults to all paths via {@link PathsOf}.
 */
export type PathValueUnion<Obj, Path extends PathsOf<Obj> = PathsOf<Obj>> = Path extends any
  ? {path: Path; value: PathValue<Obj, Path>}
  : never;
