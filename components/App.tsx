"use client";

import { lazy, Suspense } from "react";
import { usePath } from "../hooks/usePath";
import { parseRoute, type Route } from "../lib/router";
import { StudentApp } from "./student/StudentApp";

// Students never download the admin code.
const AdminApp = lazy(() => import("./admin/AdminApp").then((m) => ({ default: m.AdminApp })));

type AdminRoute = Extract<Route, { name: `admin${string}` }>;
type StudentRoute = Exclude<Route, AdminRoute>;

function isAdminRoute(route: Route): route is AdminRoute {
  return route.name.startsWith("admin");
}

/**
 * Root of both builds. `serverPath` is the requested path during server
 * rendering (vinext); in the browser the real location is used.
 */
export function App({ serverPath = "/" }: { serverPath?: string }) {
  const path = usePath(serverPath);
  const route = parseRoute(path);
  if (isAdminRoute(route)) {
    return (
      <Suspense fallback={<main className="login-page"><p className="panel-notice">Đang kiểm tra đăng nhập…</p></main>}>
        <AdminApp route={route} />
      </Suspense>
    );
  }
  return <StudentApp route={route as StudentRoute} />;
}
