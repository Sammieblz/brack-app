export interface RouteBackPolicy {
  kind: "root" | "detail" | "task" | "boundary";
  fallbackPath: string;
}

/** Presentation metadata only: route authorization stays in App/FeatureGate. */
export function getRouteBackPolicy(pathname: string, signedIn: boolean): RouteBackPolicy {
  const path = pathname.replace(/\/+$/, "") || "/";
  const fixedPath = path.toLowerCase();
  const home = signedIn ? "/dashboard" : "/";
  if (["/", "/auth", "/auth/callback", "/auth/reset-password", "/onboarding", "/app-permissions", "/welcome", "/questionnaire", "/goals"].includes(fixedPath)) {
    return { kind: "boundary", fallbackPath: home };
  }
  if (["/dashboard", "/my-books", "/books", "/lists", "/book-lists", "/feed", "/readers"].includes(fixedPath)) {
    return { kind: "root", fallbackPath: home };
  }
  const bookTask = path.match(/^\/(?:edit-book\/([^/]+)|book\/([^/]+)\/progress)$/i);
  if (bookTask) return { kind: "task", fallbackPath: `/book/${bookTask[1] ?? bookTask[2]}` };
  if (["/scan", "/scan-barcode", "/scan-cover"].includes(fixedPath)) return { kind: "task", fallbackPath: "/add-book" };
  if (fixedPath === "/add-book") return { kind: "task", fallbackPath: "/my-books" };
  const parents: Array<[RegExp, string]> = [
    [/^\/book\/[^/]+$/i, "/my-books"], [/^\/lists\/[^/]+$/i, "/lists"],
    [/^\/posts\/[^/]+$/i, "/feed"], [/^\/reviews\/[^/]+$/i, "/reviews"],
    [/^\/clubs\/[^/]+$/i, "/clubs"], [/^\/users\/[^/]+$/i, "/readers"],
  ];
  return { kind: "detail", fallbackPath: parents.find(([pattern]) => pattern.test(path))?.[1] ?? home };
}
