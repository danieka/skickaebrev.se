import { hydrate, h } from "../roc/deps.ts";
import { App } from "./app.tsx";
hydrate(<App todos={[]} />, document.body);
