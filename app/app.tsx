declare global {
  namespace JSX {
    interface IntrinsicElements {
      [key: string]: any;
    }
  }
}

import { h } from "../roc/deps.ts";
import { AppHandler } from "../roc/router.ts";

function setState(state: unknown) {
  //@ts-ignore
  window.render(state);
}

export const App: AppHandler = ({ state }) => {
  return (
    <div>
      <p>This is the value of the input: {state.input}</p>
      <input
        value={state.input}
        onInput={(e: any) => setState({ ...state, input: e.target.value })}
      />
      <button onClick={() => console.log(`saving ${state.input}`)}>save</button>
    </div>
  );
};
