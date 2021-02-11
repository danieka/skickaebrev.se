import { DB } from "https://deno.land/x/sqlite/mod.ts";
import {
  fromPairs,
  identity,
  intersection,
  keys,
  map,
  without,
  zip,
} from "http://deno.land/x/lodash@4.17.11-es/lodash.js";

let db: DB;

const SchemaSym = Symbol();
export const ErrorSym = Symbol();
export const required = Symbol();

interface BaseField {
  validator: (i: unknown) => boolean;
  dataType?: string;
  required?: true;
}

interface IntegerField extends BaseField {
  type: "integer";
}

interface StringField extends BaseField {
  type: "string";
}

type BaseFields = IntegerField | StringField;

type RequiredField<T extends BaseFields> = Required<T>;

export type Field = BaseFields | RequiredField<BaseFields>;

interface SchemaDefinition<T extends Record<string, Field>> {
  name: string;
  fields: T;
}

export type Schema<T extends Record<string, Field>> = ((
  input: EntityInput<T>
) => Entity<T>) & { data: SchemaDefinition<T> };

export type Entity<T extends Record<string, Field>> = EntityInput<T> & {
  [key: string]: Field;
  [SchemaSym]: SchemaDefinition<T>;
};

// type GetDataClass<T  extends EntityClass<any>> = T  extends EntityClass<infer U > ? U: never;
export type EntityOf<T> = T extends Schema<infer U> ? EntityInput<U> : never;

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2
  ? A
  : B;

type RequiredKeys<T extends Record<string, Field>> = {
  [P in keyof T]-?: IfEquals<
    { [Q in P]: T[P] },
    { [Q in P]: RequiredField<T[P]> },
    P,
    never
  >;
}[keyof T];

type Keys<T extends Record<string, Field>> = keyof T;

type OptionalKeys<T extends Record<string, Field>> = Exclude<
  Keys<T>,
  RequiredKeys<T>
>;

type ExtractRequiredFields<T extends Record<string, Field>> = {
  [P in RequiredKeys<T>]: T[P]["dataType"];
};

type ExtractOptionalFields<T extends Record<string, Field>> = {
  [P in OptionalKeys<T>]?: T[P]["dataType"];
};

export interface ValidationErrors {
  [ErrorSym]: true;
  [key: string]: string;
}

export type EntityInput<
  T extends Record<string, Field>
> = ExtractRequiredFields<T> & ExtractOptionalFields<T>;

export function schema<T extends Record<string, Field>>(
  name: string,
  entity: T
): Schema<T> {
  let data: SchemaDefinition<T> = {
    name,
    fields: entity,
  };
  return Object.assign(
    (input: EntityInput<T>) => {
      const entity = input as Entity<T>;
      entity[SchemaSym] = data;
      return entity;
    },
    { data }
  );
}

export type Changeset<T extends Record<string, Field>> = Partial<
  EntityInput<T>
> & {
  [SchemaSym]: SchemaDefinition<T>;
};

export function changeset<T extends Record<string, Field>>(
  schema: Schema<T>,
  fields: (keyof T)[],
  input: Record<string, unknown>
): Changeset<T> {
  const fieldsToPluck: keyof T = intersection(fields, keys(schema.data.fields));

  let changes = fromPairs(
    map(fieldsToPluck, (fieldName: string) => [
      fieldName,
      input[fieldName],
    ]).filter(([fieldName, value]) => !!value)
  );

  return schema((changes as unknown) as EntityInput<T>);
}

function validationErrors(fields: string[], message: string): ValidationErrors {
  return fromPairs([
    ...map(fields, (fieldName: string) => [fieldName, message]),
    [ErrorSym, true],
  ]) as ValidationErrors;
}

export function validate<T extends Record<string, Field>>(
  input: Changeset<T>
): EntityInput<T> | ValidationErrors {
  const schema = input[SchemaSym];
  const missingRequiredFields: string[] = without(
    Object.entries(schema.fields)
      .filter(([name, field]) => field.required)
      .map(([name]) => name),
    ...Object.keys(input)
  );

  if (missingRequiredFields.length > 0) {
    return validationErrors(missingRequiredFields, "required");
  }

  const failedValidations = Object.entries(input as EntityInput<T>)
    .filter(([fieldName, field]) => !schema.fields[fieldName].validator(field))
    .map(([fieldName]) => fieldName);

  if (failedValidations.length > 0) {
    return validationErrors(failedValidations, "validation");
  }

  return input as EntityInput<T>;
}

export function integer(): IntegerField {
  const validator = (i: unknown) =>
    typeof i === "number" && Number.isInteger(i);
  return {
    type: "integer",
    validator,
  };
}

export function string(): StringField;
export function string(isRequired: typeof required): RequiredField<StringField>;
export function string(
  isRequired?: typeof required
): StringField | RequiredField<StringField> {
  const validator = (i: unknown) => typeof i === "string";
  if (isRequired) {
    return {
      type: "string",
      validator,
      required: true,
    };
  } else {
    return {
      type: "string",
      validator,
    };
  }
}

export const Repo = {
  insert: function <T extends Record<string, Field>>(
    input: Entity<T> | Changeset<T> | ValidationErrors
  ): Entity<T> | ValidationErrors {
    if (Object.getOwnPropertySymbols(input).includes(ErrorSym)) {
      return input;
    }
    const entity = input as Entity<T>;
    const fields = Object.entries(entity[SchemaSym].fields);
    const validFields = fields.filter(([name]) => !!entity[name]);

    const query = `INSERT INTO ${entity[SchemaSym].name} (${validFields
      .map(([name]) => name)
      .join(", ")}) VALUES (${validFields.map(() => "?").join(",")})
       ON CONFLICT(id) DO UPDATE SET
      ${validFields
        .map(([name]) =>
          typeof entity[name] === "string"
            ? `${name} = '${entity[name]}'`
            : `${name} = ${entity[name]}`
        )
        .join(", ")}`;

    db.query(
      query,
      validFields.map(([name]) => entity[name])
    );

    const fieldNames = fields.map(([name]) => name);
    const [result] = db.query(
      `SELECT ${fieldNames.join(", ")} FROM ${
        entity[SchemaSym].name
      } WHERE id = ${db.lastInsertRowId}`
    );

    const res = fromPairs(zip(fieldNames, result));

    return Object.assign(entity, res);
  },
  get: function <T extends Record<string, Field>>(
    schema: Schema<T>,
    id: number
  ): Entity<T> {
    const fieldNames = Object.entries(schema.data.fields).map(([name]) => name);
    const [result] = db.query(
      `SELECT ${fieldNames.join(", ")} FROM ${
        schema.data.name
      } WHERE id = ${id}`
    );
    const fields = fromPairs(zip(fieldNames, result));
    return schema(fields as EntityInput<T>);
  },
};

export function init(filepath: string) {
  db = new DB(filepath);
}

export function runQuery(query: string) {
  db.query(query);
}

export function close() {
  db.close();
}
