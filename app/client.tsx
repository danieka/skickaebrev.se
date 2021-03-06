import { hydrate, h, render } from "../roc/deps.ts";
import { App } from "./app.tsx";

window.render = (state: any) => render(<App state={state} />, document.body);

hydrate(<App state={{ input: "stuff" }} />, document.body);
