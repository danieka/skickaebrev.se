import {
  Changeset,
  EntityInput,
  ErrorSym,
  Field,
  Repo,
  ValidationErrors,
} from "../plasm/index.ts";

export type SideEffectOutcome<T extends Changeset<Record<string, Field>>> =
  | undefined
  | "string"
  | T;

export type SideEffect<T extends EntityInput<Record<string, Field>>> = (
  input: T
) => Promise<SideEffectOutcome<Changeset<Record<string, Field>>>>;

export function doSideEffect<T extends EntityInput<Record<string, Field>>>(
  sideEffect: SideEffect<T>
): (input: T | ValidationErrors) => T | ValidationErrors {
  return (input) => {
    if (Object.getOwnPropertySymbols(input).includes(ErrorSym)) {
      return input;
    }

    const entity = input as T;

    sideEffect(entity)
      .then((outcome) => {
        if (typeof outcome === "string") {
          console.log("The outcome failed", outcome);
        }
        if (typeof outcome === "object") {
          Repo.insert(outcome);
        }
      })
      .catch((e) => console.log("the outcome failed", e));

    return entity;
  };
}
