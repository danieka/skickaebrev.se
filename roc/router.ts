type Handler = (
  request: Record<string, unknown>
) => Promise<Record<string, unknown>>;

type StringHandler = () => Promise<string>;

export type Method = "GET" | "POST";

type RoutePath = {
  route: string;
  method: Method;
};

const NotFound = Symbol();
export const App = Symbol();

export interface Router {
  add: (method: Method, route: string, handler: Handler) => Router;
  notFound: (h: Handler) => Router;
  app: (h: StringHandler) => Router;
  match: (method: Method, route: string) => Handler;
  routes: Map<RoutePath, Handler>;
  [NotFound]: Handler;
  [App]: StringHandler;
}

export function newRouter(): Router {
  const router: Router = {
    add(method: Method, route: string, handler: Handler) {
      router.routes.set({ method, route }, handler);
      return router;
    },
    notFound(handler: Handler) {
      router[NotFound] = handler;
      return router;
    },
    app(handler: StringHandler) {
      router[App] = handler;
      return router;
    },
    match(method: Method, route: string): Handler {
      const matchedRoute = router.routes.get({ method, route });
      return matchedRoute ?? router[NotFound];
    },
    routes: new Map(),
    [NotFound]: () => Promise.resolve({ "404": "not found" }),
    [App]: () => Promise.resolve("404: not found"),
  };
  return router;
}
