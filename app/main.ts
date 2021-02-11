import {
  changeset,
  init,
  Repo,
  validate,
  integer,
  required,
  schema,
  string,
  runQuery,
  EntityOf,
} from "../plasm/index.ts";
import { serve, SideEffect, doSideEffect, newRouter } from "../roc/index.ts";
import { flow, partial } from "http://deno.land/x/lodash@4.17.11-es/lodash.js";
import Random from "http://deno.land/x/random@v1.1.2/Random.js";

import { App } from "./app.tsx";

const { database } = JSON.parse(Deno.readTextFileSync("./config.json"));

init(database);
runQuery(
  "CREATE TABLE IF NOT EXISTS letter (id INTEGER PRIMARY KEY AUTOINCREMENT, apiId INTEGER, document TEXT, swishKey TEXT, recipients TEXT, createdAt TEXT, postedAt TEXT)"
);

export const Letter = schema("letter", {
  id: integer(),
  apiId: integer(),
  swishKey: string(required),
  document: string(),
  recipients: string(),
});

const r = new Random();

const generateSwishKey = (input: Record<string, unknown>) => ({
  ...input,
  swishKey: r.string(7, Random.UPPER_ALPHABETS),
});

const sendLetter: SideEffect<EntityOf<typeof Letter>> = async (input) => {
  const res = await fetch("http://localhost:9000/letter", {
    body: JSON.stringify(input),
  });
  const { id } = await res.json();
  return changeset(Letter, ["id", "apiId"], { id: input.id, apiId: id });
};

const router = newRouter()
  .add(
    "POST",
    "/letter",
    flow(
      partial(changeset, Letter, ["document", "recipients"]),
      generateSwishKey,
      validate,
      Repo.insert,
      doSideEffect(sendLetter)
    )
  )
  .app(App);

serve({ hostname: "0.0.0.0", port: 9001 }, router);
console.log(`HTTP webserver running.  Access it at:  http://localhost:9001/`);
