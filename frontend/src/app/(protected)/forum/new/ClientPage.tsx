// src/app/forum/new/page.tsx
"use client";
import { useState } from "react";

export default function ClientPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");

  const submit = async () => {
    const res = await fetch("/api/forum/questions", {
      method: "POST",
      body: JSON.stringify({
        title,
        body_markdown: body,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean).slice(0,5),
      })
    });
    if (res.ok) {
      const { data } = await res.json();
      location.href = `/forum/${data.id}`;
    } else {
      alert("Chyba pri vytváraní otázky");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h1>Nová otázka</h1>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Názov otázky" style={{ width:"100%", padding:8, margin:"8px 0" }}/>
      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Text (Markdown)" rows={10} style={{ width:"100%", padding:8, margin:"8px 0" }}/>
      <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="tagy, oddelené čiarkou" style={{ width:"100%", padding:8, margin:"8px 0" }}/>
      <button onClick={submit}>Vytvoriť</button>
    </div>
  );
}
