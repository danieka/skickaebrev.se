import { assertEquals } from "https://deno.land/std@0.85.0/testing/asserts.ts";
import {
  changeset,
  close,
  init,
  integer,
  Repo,
  required,
  schema,
  string,
  validate,
  ValidationErrors,
  ErrorSym,
  runQuery,
} from "./plasm.ts";
import { existsSync } from "https://deno.land/std/fs/mod.ts";

const Letter = schema("letter", {
  id: integer(),
  document: string(required),
  recipients: string(),
  createdAt: string(),
  postedAt: string(),
});

async function before() {
  if (existsSync("testdb.sql")) {
    await Deno.remove("testdb.sql");
  }
  init("testdb.sql");
  runQuery(
    "CREATE TABLE IF NOT EXISTS letter (id INTEGER PRIMARY KEY AUTOINCREMENT, document TEXT, recipients TEXT, createdAt TEXT, postedAt TEXT)"
  );
}

Deno.test("It should be possible to store and then read entities", async () => {
  await before();

  const entity = Letter({
    recipients: "test",
    createdAt: "test",
    postedAt: "shtuff",
    document: "docu  test",
  });

  Repo.insert(entity);

  const storedEntity = Repo.get(Letter, 1);
  assertEquals({ ...storedEntity }, { ...entity, id: 1 });
  assertEquals(storedEntity.document, "docu  test");

  const { document } = storedEntity;
  const b = { ...storedEntity };
  assertEquals(document, "docu  test");

  close();
});

Deno.test("Repo.insert should return the newly inserted entity", async () => {
  await before();

  const entity = Letter({
    recipients: "test",
    createdAt: "test",
    postedAt: "shtuff",
    document: "docutest",
  });

  const storedEntity = Repo.insert(entity);

  assertEquals({ ...storedEntity }, { ...entity, id: 1 });
  assertEquals(storedEntity.document, "docutest");

  close();
});

Deno.test("If Repo.insert receives an errormap it should return", () => {
  const error: ValidationErrors = {
    [ErrorSym]: true,
    description: "required",
  };

  const res = Repo.insert(error);

  assertEquals(error, res);
});

Deno.test("Changeset should only pluck included fields", () => {
  const changes = changeset(Letter, ["id", "document"], {
    id: 123,
    document: "test2",
    notValid: "123123",
  });

  assertEquals(changes, {
    id: 123,
    document: "test2",
  });
});

Deno.test("Validate should catch missing required fields", () => {
  const changes = changeset(Letter, ["id", "document"], {
    id: 123,
  });
  const res = validate(changes);

  assertEquals(res, { document: "required" });
});

Deno.test("Validate should catch undefined fields", () => {
  const changes = changeset(Letter, ["id", "document"], {
    id: 123,
    document: undefined,
  });

  const res = validate(changes);

  assertEquals(res, { document: "required" });
});

Deno.test("Validate should return changeset if valid", () => {
  const changes = changeset(Letter, ["id", "document"], {
    id: 123,
    document: "stuff",
  });

  const res = validate(changes);

  assertEquals(res, changes);
});

Deno.test("Only strings should validate for string field", () => {
  const e = schema("entity", {
    field: string(),
  });

  const testCases: [unknown, boolean][] = [
    ["isstring", true],
    [13, false],
    [true, false],
    [{ test: "stuff" }, false],
  ];

  for (let c of testCases) {
    const changes = changeset(e, ["field"], { field: c[0] });
    const errors = validate(changes);
    assertEquals(
      errors.field,
      c[1] ? c[0] : "validation",
      `while validating ${c[0]} got errors ${JSON.stringify(errors)}`
    );
  }
});

Deno.test("Only integers should validate for integer field", () => {
  const e = schema("entity", {
    field: integer(),
  });

  const testCases: [unknown, boolean][] = [
    ["isstring", false],
    [13, true],
    [true, false],
    [{ test: "stuff" }, false],
    [14.55, false],
  ];

  for (let c of testCases) {
    const changes = changeset(e, ["field"], { field: c[0] });
    const errors = validate(changes);
    assertEquals(
      errors.field,
      c[1] ? c[0] : "validation",
      `while validating ${c[0]} got errors ${JSON.stringify(errors)}`
    );
  }
});

Deno.test("Changeset should update the stored entity", async () => {
  await before();

  const entity = Letter({
    recipients: "a123",
    createdAt: "a123",
    postedAt: "a123",
    document: "a123",
  });

  Repo.insert(entity);

  const storedEntity = Repo.insert(
    changeset(Letter, ["id", "recipients"], {
      id: entity.id,
      recipients: "better recipients",
    })
  );

  assertEquals(
    { ...storedEntity },
    { ...entity, id: 1, recipients: "better recipients" }
  );

  close();
});
Deno.test("An empty changeset should not change the database", () => {});
Deno.test(
  "Inputing null in changeset should unset the field in database",
  () => {}
);
Deno.test("It should not be possible to unset required fields", () => {});
Deno.test("The date now symbol should ", () => {});
