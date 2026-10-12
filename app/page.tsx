
"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your Graph Memory Agent. I'm now being connected to Gemini. Ask me anything!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();

    if (!text || loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: text },
    ]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "The AI request failed."
        );
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.reply || "Gemini returned an empty response.",
        },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `Error: ${error.message}`
              : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1020] text-white md:flex">
      <aside className="border-b border-white/10 p-6 md:min-h-screen md:w-72 md:border-b-0 md:border-r">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500 text-xl font-bold">
            G
          </div>
          <div>
            <h1 className="font-semibold">Graph Memory</h1>
            <p className="text-xs text-slate-400">AI Agent Workspace</p>
          </div>
        </div>

        <p className="mb-3 text-xs uppercase tracking-widest text-slate-500">
          Workspace
        </p>
        <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-3">
          <p className="font-medium">✦ Memory Chat</p>
          <p className="mt-1 text-xs text-slate-400">Talk to your agent</p>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium">AI system</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Gemini integration
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Persistent graph memory is the next milestone.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 p-4">
          <p className="text-sm font-medium">Our next milestone</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Store people, facts and relationships in a knowledge graph.
          </p>
        </div>
      </aside>

      <section className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="border-b border-white/10 px-5 py-5 md:px-10">
          <p className="text-sm text-slate-400">PROJECT / AGENT MEMORY</p>
          <h2 className="mt-1 text-xl font-semibold">Your memory assistant</h2>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 md:px-8">
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-violet-300">
              Welcome to Graph Memory Agent
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The goal: an AI that remembers useful information, connects
              related facts and uses them to answer future questions.
            </p>
          </div>

          <div className="flex-1 space-y-5">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
                    G
                  </div>
                )}

                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-violet-600"
                      : "border border-white/10 bg-white/[0.04] text-slate-200"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {loading && (
              <p className="text-sm text-slate-400">
                Gemini is thinking...
              </p>
            )}
          </div>

          <form onSubmit={sendMessage} className="mt-8">
            <div className="flex gap-2 rounded-2xl border border-white/15 bg-white/[0.04] p-2 focus-within:border-violet-400/60">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Gemini something..."
                aria-label="Message your agent"
                disabled={loading}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              Gemini AI · Persistent graph memory not connected yet
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
