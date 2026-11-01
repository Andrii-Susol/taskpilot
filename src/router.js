// Minimal router: supports static segments and ":param" segments.
export function createRouter() {
  const routes = [];

  function add(method, pattern, handler) {
    const parts = pattern.split('/').filter(Boolean);
    routes.push({ method, parts, handler });
  }

  function match(method, pathname) {
    const segments = pathname.split('/').filter(Boolean);
    let pathMatched = false;
    for (const route of routes) {
      if (route.parts.length !== segments.length) continue;
      const params = {};
      const ok = route.parts.every((part, i) => {
        if (part.startsWith(':')) {
          params[part.slice(1)] = decodeURIComponent(segments[i]);
          return true;
        }
        return part === segments[i];
      });
      if (!ok) continue;
      pathMatched = true;
      if (route.method === method) return { handler: route.handler, params };
    }
    return { handler: null, params: {}, methodNotAllowed: pathMatched };
  }

  return { add, match };
}
