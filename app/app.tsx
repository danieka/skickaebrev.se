declare global {
  namespace JSX {
    interface IntrinsicElements {
      [key: string]: any;
    }
  }
}

import { h } from "../roc/deps.ts";

export function App() {
  return (
    <div>
      <h1>Hello STututuff</h1>
      <button onClick={() => console.log("helloouu")}>Here is a button</button>
    </div>
  );
}
