"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Message = { role: "user" | "assistant"; content: string; memoryId?: string };

const starterPrompts = [
  "Remember that my hackathon project uses FalkorDB.",
  "What do you remember about my project?",
  "Connect the people and tools I have mentioned.",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello — I’m your Graph Memory Agent. Tell me something worth remembering, or ask about a fact you’ve already shared." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setMessages((previous) => [...previous, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const conversation = messages.slice(-8).map(({ role, content, memoryId }) => ({ role, content, ...(memoryId ? { memoryId } : {}) }));
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, conversation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The AI request failed.");
      setMessages((previous) => {
        const withMemoryId = previous.map((item, index) => index === previous.length - 1 && item.role === "user" && typeof data.memoryId === "string" ? { ...item, memoryId: data.memoryId } : item);
        return [...withMemoryId, { role: "assistant", content: data.reply || "Gemini returned an empty response." }];
      });
    } catch (error) {
      setMessages((previous) => [...previous, { role: "assistant", content: error instanceof Error ? `I couldn’t reach the memory service: ${error.message}` : "I couldn’t reach the memory service. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] lg:flex">
      <aside className="border-b border-white/10 bg-[#0e1425] px-5 py-5 lg:flex lg:min-h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="brand-mark" aria-hidden="true">G</div><div><p className="font-semibold tracking-tight">Graph Memory</p><p className="text-xs text-slate-500">AI agent workspace</p></div></div><span className="status-dot" title="Workspace available" aria-label="Workspace available" /></div>
        <nav className="mt-8" aria-label="Workspace navigation"><p className="eyebrow mb-3">Workspace</p><Link className="nav-item nav-item-active" href="/" aria-current="page"><span aria-hidden="true">✦</span><span><strong>Memory chat</strong><small>Talk to your agent</small></span></Link><Link className="nav-item" href="/graph"><span aria-hidden="true">◌</span><span><strong>Graph explorer</strong><small>Inspect connected facts</small></span></Link></nav>
        <div className="mt-8 hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:block"><p className="text-sm font-medium">Memory, made visible</p><p className="mt-2 text-xs leading-5 text-slate-400">Save useful facts, connect related entities, and build context that improves over time.</p><div className="mt-4 flex items-center gap-2 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />Gemini + FalkorDB connected</div></div>
        <p className="mt-auto hidden pt-8 text-xs leading-5 text-slate-600 lg:block">Your memory graph is designed to grow one useful connection at a time.</p>
      </aside>
      <section className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="border-b border-white/10 bg-[#0b1020]/80 px-5 py-5 backdrop-blur md:px-10"><div className="mx-auto flex w-full max-w-4xl items-start justify-between gap-4"><div><p className="eyebrow">Project / Agent memory</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">Your memory assistant</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">A conversational front door to the people, projects, and relationships in your graph.</p></div><Link href="/graph" className="secondary-button hidden sm:inline-flex">Open graph <span aria-hidden="true">→</span></Link></div></header>
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 md:px-8 md:py-10">
          <div className="welcome-card"><div className="flex items-start gap-4"><div className="icon-tile" aria-hidden="true">✦</div><div><p className="text-sm font-semibold text-violet-200">A memory layer for your work</p><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Share a fact or ask a question. The agent stores useful context in FalkorDB and uses it when it can support a better answer.</p></div></div></div>
          <div className="mt-8 flex-1 space-y-5" aria-live="polite" aria-label="Conversation">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>{message.role === "assistant" && <div className="avatar avatar-agent" aria-hidden="true">G</div>}<div className={`message-bubble ${message.role === "user" ? "message-user" : "message-agent"}`}>{message.content}</div></div>)}{loading && <div className="flex items-center gap-3 text-sm text-slate-400" role="status"><div className="avatar avatar-agent" aria-hidden="true">G</div><span className="typing-indicator"><i /><i /><i /> Thinking through your graph…</span></div>}</div>
          <div className="mt-8"><p className="eyebrow mb-3">Try a prompt</p><div className="flex gap-2 overflow-x-auto pb-2" aria-label="Suggested prompts">{starterPrompts.map((prompt) => <button key={prompt} type="button" className="prompt-chip" onClick={() => setInput(prompt)}>{prompt}</button>)}</div></div>
          <form onSubmit={sendMessage} className="mt-3"><div className="composer"><label htmlFor="message" className="sr-only">Message your agent</label><textarea id="message" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="Tell me something to remember…" rows={1} disabled={loading} className="min-h-12 min-w-0 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 outline-none placeholder:text-slate-600 disabled:opacity-50" /><button type="submit" disabled={loading || !input.trim()} className="primary-button self-end">{loading ? "Sending…" : "Send"}<span aria-hidden="true">↗</span></button></div><p className="mt-3 text-center text-xs text-slate-600">Enter to send · Shift + Enter for a new line</p></form>
        </div>
      </section>
    </main>
  );
}
