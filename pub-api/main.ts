import { flow, partial } from "http://deno.land/x/lodash@4.17.11-es/lodash.js";
import {
  changeset,
  init,
  Repo,
  runQuery,
  validate,
  integer,
  required,
  schema,
  string,
  EntityOf,
} from "../plasm/plasm.ts";
import { newRouter, serve, doSideEffect, SideEffect } from "../roc/index.ts";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";

const { database, smtp } = JSON.parse(Deno.readTextFileSync("./config.json"));

init(database);
runQuery(
  "CREATE TABLE IF NOT EXISTS letter (id INTEGER PRIMARY KEY AUTOINCREMENT, document TEXT, recipients TEXT, createdAt TEXT, postedAt TEXT)"
);

export const Letter = schema("letter", {
  id: integer(),
  document: string(required),
  recipients: string(),
  createdAt: string(),
  postedAt: string(),
});

const sendEmail: SideEffect<EntityOf<typeof Letter>> = async (input) => {
  const client = new SmtpClient();
  await client.connectTLS(smtp);

  await client.send({
    from: "daniel@skickaebrev.se",
    to: "mail@danielk.se",
    subject: "Nytt brev!!",
    content: "Nytt brev har sparats i databasen",
  });

  console.log(`I sent the email for document ${input.document}`);
  return changeset(Letter, [], {});
};

const router = newRouter().add(
  "POST",
  "/letter",
  flow(
    partial(changeset, Letter, ["document", "recipients"]),
    validate,
    Repo.insert,
    doSideEffect(sendEmail)
  )
);

serve({ hostname: "0.0.0.0", port: 9000 }, router);
console.log(`HTTP webserver running.  Access it at:  http://localhost:9000/`);
