// prudent-frontend/lib/api.ts

export type Scope = "internal" | "web" | "hybrid";

export type ChatRole = "user" | "assistant";

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

export interface Source {
  id: string;
  title: string;
  section: string;
  source: string; // may be a URL for web, or path/name for internal
  accessLevel: "public" | "internal";
  snippet: string;
  fullText: string;
  // extra fields may exist from backend; we ignore them safely
  [key: string]: any;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  follow_up_questions: string[];
  chat_session_id?: string;
  chat_session_title?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  updated_at?: string | null;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  created_at?: string | null;
}

export interface WebSearchResult {
  title: string;
  link: string;
  snippet?: string;
  [key: string]: any;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:8000";

/** Defensive normalization so UI doesn't break when backend fields differ slightly */
function normalizeSource(s: any, idx: number): Source {
  const id = String(s?.id ?? "").trim() || `src-${idx}-${Math.abs(hashString(JSON.stringify(s ?? {})))}`;

  const title = String(s?.title ?? s?.metadata?.title ?? "Source").trim();
  const section = String(s?.section ?? s?.metadata?.section ?? s?.metadata?.heading ?? "").trim();
  const source = String(s?.source ?? s?.url ?? s?.metadata?.source ?? s?.metadata?.path ?? "").trim();

  // backend may send accessLevel or access_level etc.
  const alRaw = String(s?.accessLevel ?? s?.access_level ?? s?.metadata?.accessLevel ?? s?.metadata?.access_level ?? "internal").toLowerCase();
  const accessLevel: "public" | "internal" = alRaw === "public" ? "public" : "internal";

  const snippet = String(s?.snippet ?? s?.metadata?.snippet ?? s?.metadata?.text ?? "").trim();
  const fullText = String(s?.fullText ?? s?.full_text ?? s?.metadata?.fullText ?? s?.metadata?.text ?? snippet).trim();

  return {
    ...s,
    id,
    title,
    section,
    source,
    accessLevel,
    snippet,
    fullText,
  };
}

function normalizeSources(arr: any): Source[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((s, i) => normalizeSource(s, i));
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return h;
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (j?.detail) return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    return JSON.stringify(j);
  } catch {
    try {
      return await res.text();
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}

/** Main chat call used by the UI */
export async function askKnowledgeAgent(params: {
  question: string;
  scope: Scope;
  agent: string;
  strictCitations: boolean;
  history: ChatHistoryMessage[];
  chatSessionId?: string | null;
}): Promise<ChatResponse> {
  const {
    question,
    scope,
    agent,
    strictCitations,
    history,
    chatSessionId,
  } = params;

  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // IMPORTANT: matches backend ChatRequest
    body: JSON.stringify({
      query: question,
      scope,
      agent,
      strict_citations: strictCitations,
      history,
      chat_session_id: chatSessionId || undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = await res.json();

  return {
    answer: String(data?.answer ?? ""),
    sources: normalizeSources(data?.sources),
    follow_up_questions: Array.isArray(data?.follow_up_questions)
      ? data.follow_up_questions.map((x: any) => String(x))
      : Array.isArray(data?.follow_ups)
        ? data.follow_ups.map((x: any) => String(x))
        : [],
    chat_session_id: data?.chat_session_id ? String(data.chat_session_id) : undefined,
    chat_session_title: data?.chat_session_title ? String(data.chat_session_title) : undefined,
  };
}

/** List previous chat sessions (for left panel) */
export async function listChatSessions(): Promise<ChatSession[]> {
  const res = await fetch(`${API_BASE_URL}/api/chat/sessions`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((s: any) => ({
    id: String(s?.id ?? ""),
    title: String(s?.title ?? "New chat"),
    preview: String(s?.preview ?? ""),
    updated_at: s?.updated_at ? String(s.updated_at) : null,
  }));
}

/** Load messages of a specific session (when user clicks a session) */
export async function getChatSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((m: any) => ({
    id: String(m?.id ?? ""),
    role: (m?.role === "assistant" ? "assistant" : "user") as ChatRole,
    content: String(m?.content ?? ""),
    created_at: m?.created_at ? String(m.created_at) : null,
  }));
}

/** Optional: test endpoints from UI */
export async function testLLM(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/test/llm`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function testRAG(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/test/rag`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function testSerper(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/test/serper`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** If your backend has /api/websearch and you want a UI button for it */
export async function webSearch(query: string, numResults = 5): Promise<WebSearchResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/websearch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, num_results: numResults }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.results ?? []);
}
