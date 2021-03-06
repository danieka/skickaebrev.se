import { Router, Method, App } from "./router.ts";
import { serve as denoServe } from "https://deno.land/std@0.85.0/http/server.ts";
import { decode } from "https://deno.land/std@0.85.0/encoding/utf8.ts";
import { default as htm } from "https://cdn.pika.dev/htm";
import { h } from "https://cdn.pika.dev/preact";
import { renderToString } from "https://cdn.pika.dev/preact-render-to-string";

const {
  files: { "deno:///bundle.js": clientJS },
  //@ts-ignore
} = await Deno.emit(`./client.tsx`, {
  bundle: "esm",
  compilerOptions: {
    jsx: "react",
    jsxFactory: "h",
  },
});

export async function serve(options: Deno.ListenOptions, router: Router) {
  const server = denoServe(options);
  for await (const request of server) {
    const bodyBuf = new Deno.Buffer();
    await Deno.copy(request.body, bodyBuf);
    if (request.headers.get("content-type")) {
      let jsonBody: Record<string, unknown>;
      try {
        jsonBody = JSON.parse(decode(bodyBuf.bytes()));
      } catch {
        request.respond({ status: 500, body: "Could not parse JSON input" });
        continue;
      }

      const resp = router.match(
        request.method as Method,
        request.url
      )(jsonBody);
      request.respond({ status: 200, body: JSON.stringify(await resp) });
    } else {
      if (request.url === "/roc/client.js") {
        const headers = new Headers();
        headers.set("Content-Type", "application/javascript");
        request.respond({
          status: 200,
          body: clientJS as string,
          headers,
        });
        continue;
      }

      const html = htm.bind(h);

      const app = router[App];

      const a = () => app({ state: { input: "stuff" } });

      const body = renderToString(html`
        <html>
          <head>
            <script src="/roc/client.js" type="module"></script>
          </head>
          <body>
            <${a} />
          </body>
        </html>
      `);

      request.respond({ status: 200, body });
    }
  }
}
