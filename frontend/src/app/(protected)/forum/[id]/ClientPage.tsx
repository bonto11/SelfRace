// src/app/forum/[id]/page.tsx
"use client";

import useSWR from "swr";
import { useState } from "react";

type Props = { id: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ClientPage({ id }: Props) {
  const { data, mutate, isLoading } = useSWR(`/api/forum/questions/${id}`, fetcher);
  const [comment, setComment] = useState("");

  if (isLoading || !data) return <div className="p-6">Načítavam…</div>;

  const { question, comments } = data;

  const addComment = async () => {
    const body_markdown = comment.trim();
    if (body_markdown.length < 2) return;
    const res = await fetch("/api/forum/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: question.id, body_markdown }),
    });
    if (res.ok) {
      setComment("");
      mutate();
    }
  };

  const vote = async (
    commentId: string,
    value: "AGREE" | "PARTIAL" | "MISLEADING"
  ) => {
    await fetch("/api/forum/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_id: commentId, value }),
    });
    mutate();
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8 }}>
        <h2 style={{ margin: 0 }}>{question.title}</h2>
        <div style={{ opacity: 0.8, fontSize: 14, marginTop: 6 }}>
          {new Date(question.created_at).toLocaleString()}
        </div>
        {!!(question.tags?.length) && (
          <div style={{ opacity: 0.8, fontSize: 12, marginTop: 6 }}>
            {question.tags.join(" • ")}
          </div>
        )}
        <pre style={{ whiteSpace: "pre-wrap" }}>{question.body_markdown}</pre>
      </div>

      <div>
        <h3>Odpovede</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {comments.map((c: any) => (
            <div
              key={c.id}
              style={{ padding: 12, border: "1px solid #333", borderRadius: 8 }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {new Date(c.created_at).toLocaleString()}
              </div>
              <pre style={{ whiteSpace: "pre-wrap" }}>{c.body_markdown}</pre>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => vote(c.id, "AGREE")}>
                  Súhlas ({c.votes.AGREE})
                </button>
                <button onClick={() => vote(c.id, "PARTIAL")}>
                  Nie tak úplne ({c.votes.PARTIAL})
                </button>
                <button onClick={() => vote(c.id, "MISLEADING")}>
                  Zavádzanie ({c.votes.MISLEADING})
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            placeholder="Napíš odpoveď…"
            style={{ width: "100%", padding: 8 }}
          />
          <div style={{ marginTop: 8 }}>
            <button onClick={addComment} disabled={comment.trim().length < 2}>
              Odoslať
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
