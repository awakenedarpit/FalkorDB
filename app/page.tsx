"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string; memoryId?: string };
type ChatSession = { id: string; title: string; createdAt: number; updatedAt: number; messages: Message[] };
type Theme = "dark" | "light";
type AuthMode = "login" | "signup";
type UploadPreview = { name: string; kind: string; size: number; text: string; headings: string[]; tables: { title: string; rows: string[][] }[]; references: string[]; truncated: boolean };

const acceptedFiles = ".pdf,.docx,.pptx,.txt,.md,.csv,.jpg,.jpeg,.png,.webp";
const maxUploadFiles = 5;
const maxUploadFileBytes = 10 * 1024 * 1024;

const starterPrompts = [
  { icon: "✦", label: "Remember a fact", text: "Remember that my hackathon project uses FalkorDB." },
  { icon: "⌕", label: "Recall context", text: "What do you remember about my project?" },
  { icon: "◌", label: "Explore a connection", text: "Connect the people and tools I have mentioned." },
];

const welcomeMessage: Message = { role: "assistant", content: "Hello — I’m your Graph Memory Agent. I can remember the useful details behind your work, connect the dots, and bring them back when you need them." };

function createChat(): ChatSession {
  const now = Date.now();
  return { id: `chat-${now}-${Math.random().toString(36).slice(2, 7)}`, title: "New memory chat", createdAt: now, updatedAt: now, messages: [welcomeMessage] };
}

function formatChatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [extractionPreviews, setExtractionPreviews] = useState<UploadPreview[]>([]);
  const [attachmentToken, setAttachmentToken] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");

  const activeChat = sessions.find((session) => session.id === activeId) || sessions[0];
  const visibleSessions = useMemo(() => sessions.filter((session) => session.title.toLowerCase().includes(chatSearch.toLowerCase())), [sessions, chatSearch]);

  useEffect(() => {
    const storedChats = window.localStorage.getItem("graph-memory-chats");
    const initial = storedChats ? JSON.parse(storedChats) as ChatSession[] : [createChat()];
    setSessions(initial.length ? initial : [createChat()]);
    setActiveId(initial[0]?.id || "");
    const storedTheme = window.localStorage.getItem("graph-memory-theme") as Theme | null;
    const nextTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    const storedProfile = window.localStorage.getItem("graph-memory-profile");
    if (storedProfile) setProfile(JSON.parse(storedProfile));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("graph-memory-chats", JSON.stringify(sessions));
  }, [sessions, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("graph-memory-theme", theme);
  }, [theme, mounted]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeChat?.messages.length, loading]);

  function updateActiveChat(updater: (chat: ChatSession) => ChatSession) {
    setSessions((previous) => previous.map((chat) => chat.id === activeChat?.id ? updater(chat) : chat));
  }

  function startNewChat() {
    const next = createChat();
    setSessions((previous) => [next, ...previous]);
    setActiveId(next.id);
    setInput("");
    setSidebarOpen(false);
  }

  function selectChat(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
  }

  async function previewFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length) return;
    if (files.length > maxUploadFiles) { setUploadError(`Choose no more than ${maxUploadFiles} files at a time.`); return; }
    if (files.some((file) => file.size > maxUploadFileBytes)) { setUploadError("Each file must be 10 MB or smaller."); return; }
    if (files.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) { setUploadError("The combined upload size must be 20 MB or smaller."); return; }
    setAttachedFiles(files);
    setExtractionPreviews([]);
    setAttachmentToken("");
    setUploadError("");
    setUploading(true);
    setUploadStatus("Validating files and extracting content…");
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The selected files could not be extracted.");
      setExtractionPreviews(Array.isArray(data.files) ? data.files as UploadPreview[] : []);
      setAttachmentToken(typeof data.token === "string" ? data.token : "");
      setUploadStatus(`${files.length} ${files.length === 1 ? "file" : "files"} extracted. Review the preview before sending.`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The selected files could not be extracted.");
      setUploadStatus("");
    } finally {
      setUploading(false);
    }
  }

  function removeFile(index: number) {
    setAttachedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setExtractionPreviews((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setAttachmentToken("");
    setUploadError("");
    setUploadStatus(attachedFiles.length <= 1 ? "" : "File removed. Re-select the remaining files to refresh their secure preview.");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    const filesReady = attachedFiles.length > 0 && extractionPreviews.length === attachedFiles.length && Boolean(attachmentToken) && !uploadError;
    if ((!text && !filesReady) || loading || uploading || !activeChat) return;
    const userText = text || "Please summarize the attached files.";
    const displayedUserText = attachedFiles.length ? `${userText}\n\nAttachments: ${attachedFiles.map((file) => file.name).join(", ")}` : userText;
    const conversation = activeChat.messages.slice(-8).map(({ role, content, memoryId }) => ({ role, content, ...(memoryId ? { memoryId } : {}) }));
    updateActiveChat((chat) => ({ ...chat, title: chat.title === "New memory chat" ? userText.slice(0, 48) : chat.title, updatedAt: Date.now(), messages: [...chat.messages, { role: "user", content: displayedUserText }] }));
    setInput("");
    setLoading(true);
    try {
      let response: Response;
      if (attachedFiles.length) {
        const formData = new FormData();
        formData.set("message", text);
        formData.set("conversation", JSON.stringify(conversation));
        formData.set("attachmentToken", attachmentToken);
        response = await fetch("/api/chat", { method: "POST", body: formData });
      } else {
        response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, conversation }) });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The AI request failed.");
      updateActiveChat((chat) => ({ ...chat, updatedAt: Date.now(), messages: chat.messages.map((item, index) => index === chat.messages.length - 1 && item.role === "user" && typeof data.memoryId === "string" ? { ...item, memoryId: data.memoryId } : item).concat({ role: "assistant", content: data.reply || "Gemini returned an empty response." }) }));
      setAttachedFiles([]);
      setExtractionPreviews([]);
      setAttachmentToken("");
      setUploadStatus("");
    } catch (error) {
      updateActiveChat((chat) => ({ ...chat, updatedAt: Date.now(), messages: [...chat.messages, { role: "assistant", content: error instanceof Error ? `I couldn’t reach the memory service: ${error.message}` : "I couldn’t reach the memory service. Please try again." }] }));
    } finally {
      setLoading(false);
    }
  }

  function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const name = String(form.get("name") || "").trim() || email.split("@")[0] || "Explorer";
    if (!email) return;
    const nextProfile = { name, email };
    setProfile(nextProfile);
    window.localStorage.setItem("graph-memory-profile", JSON.stringify(nextProfile));
    setAuthNotice(authMode === "signup" ? "Your local workspace profile is ready." : "Welcome back to your local workspace.");
    window.setTimeout(() => { setAuthOpen(false); setAuthNotice(""); }, 900);
  }

  return (
    <main className="app-shell">
      <div className={`mobile-scrim ${sidebarOpen ? "is-visible" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      <aside className={`workspace-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-topline"><Link href="/" className="brand" aria-label="Graph Memory home"><span className="brand-symbol">G</span><span><strong>Graph Memory</strong><small>Personal knowledge workspace</small></span></Link><button type="button" className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">×</button></div>
        <button type="button" className="new-chat-button" onClick={startNewChat}><span className="new-chat-plus">＋</span> New chat <kbd>⌘ K</kbd></button>
        <nav className="workspace-nav" aria-label="Workspace navigation"><p className="nav-label">Workspace</p><Link href="/" className="workspace-link workspace-link-active"><span className="nav-icon">✦</span><span>Memory chat</span><span className="nav-arrow">⌘ 1</span></Link><Link href="/graph" className="workspace-link"><span className="nav-icon">◌</span><span>Graph explorer</span><span className="nav-arrow">⌘ 2</span></Link></nav>
        <div className="chat-history"><div className="history-heading"><p className="nav-label">Your chats</p><button type="button" className="icon-button small" aria-label="Search chats" onClick={() => document.getElementById("chat-search")?.focus()}>⌕</button></div><div className="search-field"><span>⌕</span><input id="chat-search" value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Search chats" aria-label="Search chats" /></div><div className="history-list">{visibleSessions.length ? visibleSessions.map((session) => <button key={session.id} type="button" className={`history-item ${activeChat?.id === session.id ? "history-item-active" : ""}`} onClick={() => selectChat(session.id)}><span className="history-item-title">{session.title}</span><span className="history-item-date">{formatChatDate(session.updatedAt)}</span></button>) : <p className="empty-history">No chats found</p>}</div></div>
        <div className="sidebar-footer"><div className="plan-card"><div className="plan-card-icon">✦</div><div><strong>Memory is growing</strong><p>Connect more facts to make recall richer.</p></div></div><div className="footer-row"><button type="button" className="profile-button" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}><span className="profile-avatar">{profile?.name?.[0]?.toUpperCase() || "A"}</span><span className="profile-copy"><strong>{profile?.name || "Guest explorer"}</strong><small>{profile?.email || "Sign in to sync"}</small></span></button><button type="button" className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? "☼" : "◐"}</button></div></div>
      </aside>

      <section className="main-workspace">
        <header className="topbar"><div className="topbar-left"><button type="button" className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">☰</button><div className="mobile-page-title"><span className="status-dot" /> Graph Memory</div><div className="model-picker"><span className="model-orb">✦</span><span><strong>Graph Memory</strong><small>Automatic context</small></span><span className="chevron">⌄</span></div></div><div className="topbar-actions"><span className="connection-status"><i /> <span>FalkorDB connected</span></span><button type="button" className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme">{theme === "dark" ? "☼" : "◐"}</button><button type="button" className="share-button" onClick={() => navigator.clipboard?.writeText(window.location.href)}><span>↗</span> Share</button><button type="button" className="top-avatar" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>{profile?.name?.[0]?.toUpperCase() || "A"}</button></div></header>
        <div className="chat-viewport"><div className="chat-column">
          <div className="chat-heading"><div className="heading-kicker"><span className="sparkle">✦</span> Your private knowledge layer</div><h1>{activeChat?.title === "New memory chat" ? "What would you like to remember?" : activeChat?.title}</h1><p>Store the details behind your work, then ask questions that span people, projects, and relationships.</p></div>
          <div className="message-list" aria-live="polite" aria-label="Conversation">{activeChat?.messages.map((message, index) => <div key={`${activeChat.id}-${message.role}-${index}`} className={`message-row ${message.role === "user" ? "message-row-user" : ""}`}><div className={`message-avatar ${message.role === "user" ? "user-avatar" : "agent-avatar"}`}>{message.role === "user" ? (profile?.name?.[0]?.toUpperCase() || "A") : "✦"}</div><div className="message-content"><div className="message-meta"><strong>{message.role === "user" ? profile?.name || "You" : "Graph Memory"}</strong><span>{message.role === "user" ? "Just now" : "Agent response"}</span></div><div className={`message-text ${message.role === "user" ? "message-text-user" : ""}`}>{message.content}</div></div></div>)}{loading && <div className="message-row" role="status"><div className="message-avatar agent-avatar">✦</div><div className="message-content"><div className="message-meta"><strong>Graph Memory</strong><span>Thinking</span></div><div className="loading-line"><span /><span /><span /></div></div></div>}<div ref={endRef} /></div>
          {activeChat?.messages.length === 1 && <div className="starter-grid">{starterPrompts.map((prompt) => <button key={prompt.text} type="button" className="starter-card" onClick={() => setInput(prompt.text)}><span className="starter-icon">{prompt.icon}</span><span><strong>{prompt.label}</strong><small>{prompt.text}</small></span><span className="starter-arrow">↗</span></button>)}</div>}
          <form onSubmit={sendMessage} className="composer-wrap">
            {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}
            {uploadStatus && <p className="upload-status" role="status">{uploading && <span className="upload-spinner" aria-hidden="true" />} {uploadStatus}</p>}
            {attachedFiles.length > 0 && <div className="attachment-list" aria-label="Attached files">
              {attachedFiles.map((file, index) => {
                const preview = extractionPreviews[index];
                return <article className="attachment-card" key={`${file.name}-${file.lastModified}-${index}`}>
                  <div className="attachment-topline"><span className="attachment-file-icon" aria-hidden="true">▤</span><div className="attachment-file-copy"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(file.size < 1024 * 1024 ? 2 : 1)} MB{preview ? ` · ${preview.kind.toUpperCase()}` : " · Processing"}</small></div><button type="button" className="attachment-remove" disabled={loading || uploading} onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>×</button></div>
                  {preview ? <details className="extraction-preview"><summary>Extraction preview{preview.truncated ? " (truncated)" : ""}</summary>
                    {preview.headings.length > 0 && <p><strong>Headings:</strong> {preview.headings.slice(0, 8).join(" · ")}</p>}
                    {preview.references.length > 0 && <p><strong>References:</strong> {preview.references.slice(0, 12).join(", ")}</p>}
                    {preview.tables.map((table, tableIndex) => <div className="preview-table" key={`${table.title}-${tableIndex}`}><strong>{table.title}</strong>{table.rows.slice(0, 5).map((row, rowIndex) => <div key={rowIndex}>{row.join(" | ")}</div>)}</div>)}
                    <pre>{preview.text.slice(0, 3000)}{preview.text.length > 3000 ? "…" : ""}</pre>
                  </details> : <p className="attachment-wait">{uploading ? "Checking file signature and extracting content…" : "Preview unavailable."}</p>}
                </article>;
              })}
            </div>}
            <div className="premium-composer">
              <div className="composer-tools"><input ref={uploadInputRef} className="upload-input" type="file" accept={acceptedFiles} multiple onChange={previewFiles} aria-label="Choose files to attach" /><button type="button" className="composer-icon" aria-label="Attach documents or images" title="Attach PDF, DOCX, PPTX, TXT, Markdown, CSV, JPG, PNG, or WEBP" disabled={loading || uploading} onClick={() => uploadInputRef.current?.click()}>＋</button></div>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Message your memory agent…" rows={1} disabled={loading || uploading} aria-label="Message your memory agent" />
              <div className="composer-actions"><span className="composer-hint">{loading ? "Working…" : uploading ? "Extracting…" : "↵ to send"}</span><button type="submit" className="send-button" disabled={loading || uploading || Boolean(uploadError) || (!input.trim() && !(attachedFiles.length > 0 && extractionPreviews.length === attachedFiles.length && Boolean(attachmentToken)))} aria-label="Send message">↑</button></div>
            </div>
            <p className="composer-disclaimer">Files are processed in memory; extracted content is saved as a memory when sent. Graph Memory can make mistakes—check important information against your source graph.</p>
          </form>
        </div></div>
      </section>

      {authOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setAuthOpen(false); }}><div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button type="button" className="modal-close icon-button" onClick={() => setAuthOpen(false)} aria-label="Close account dialog">×</button><div className="auth-mark">✦</div><h2 id="auth-title">{authMode === "login" ? "Welcome back" : "Create your workspace"}</h2><p className="auth-subtitle">{authMode === "login" ? "Sign in to keep your memory workspace close." : "Start building a private layer for your work."}</p><div className="auth-tabs"><button type="button" className={authMode === "login" ? "auth-tab-active" : ""} onClick={() => setAuthMode("login")}>Sign in</button><button type="button" className={authMode === "signup" ? "auth-tab-active" : ""} onClick={() => setAuthMode("signup")}>Create account</button></div><form onSubmit={submitAuth} className="auth-form">{authMode === "signup" && <label>Full name<input name="name" type="text" placeholder="Alex Morgan" /></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" required /></label><label>Password<input name="password" type="password" placeholder="••••••••" required /></label><button type="submit" className="auth-submit">{authMode === "login" ? "Sign in" : "Create account"}<span>→</span></button></form><p className="auth-note">This visual account flow stores a local profile in your browser. Connect your auth provider to enable secure account sync.</p>{authNotice && <p className="auth-success">{authNotice}</p>}</div></div>}
    </main>
  );
}
