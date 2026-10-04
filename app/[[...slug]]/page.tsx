import { App } from "../../components/App";

type PageProps = { params: Promise<{ slug?: string[] }> };

/** Every path is handled by the client router in components/App.tsx. */
export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const path = `/${(slug ?? []).map(encodeURIComponent).join("/")}`;
  return <App serverPath={path} />;
}
