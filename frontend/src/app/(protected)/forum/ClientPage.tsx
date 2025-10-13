// src/app/forum/ClientPage.tsx
"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ClientPage() {
  const { data, isLoading } = useSWR("/api/forum/questions/list", fetcher);

  if (isLoading || !data) return <div className="p-6">Načítavam…</div>;
  const questions = data?.data ?? [];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Fórum</h1>
        <a href="/forum/new" style={{ padding: "8px 12px", border: "1px solid #333", borderRadius: 8 }}>
          + Nová otázka
        </a>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {questions.map((q: any) => (
          <a
            key={q.id}
            href={`/forum/${q.id}`}
            style={{ padding: 12, border: "1px solid #333", borderRadius: 8, display: "block" }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{q.title}</div>
            {!!(q.tags?.length) && (
              <div style={{ opacity: .7, fontSize: 12, marginBottom: 6 }}>
                {q.tags.join(" • ")}
              </div>
            )}
            <div style={{ opacity: .7, fontSize: 12 }}>
              {new Date(q.created_at).toLocaleString()}
            </div>
          </a>
        ))}
        {questions.length === 0 && (
          <div style={{ opacity: .8 }}>Zatiaľ žiadne otázky.</div>
        )}
      </div>
    </div>
  );
}
