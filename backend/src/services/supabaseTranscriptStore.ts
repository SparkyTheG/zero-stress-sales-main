type VerifyResult = { userId: string; email?: string };

function getBaseUrl(): string | null {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, '');
}

function getServiceKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return key;
}

function buildHeaders(authBearer: string): Record<string, string> {
  const serviceKey = getServiceKey();
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${authBearer}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseFetch(path: string, init: RequestInit): Promise<Response> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error('SUPABASE_URL is not set');
  const url = `${baseUrl}${path}`;
  return await fetch(url, init);
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<VerifyResult> {
  const serviceKey = getServiceKey();
  const baseUrl = getBaseUrl();
  if (!baseUrl || !serviceKey) {
    throw new Error('Supabase env not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  }

  const res = await supabaseFetch('/auth/v1/user', {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Invalid access token (${res.status}): ${text || res.statusText}`);
  }

  const data: any = await res.json();
  if (!data?.id) throw new Error('Invalid user response from Supabase');
  return { userId: data.id, email: data.email };
}

export async function createCallSession(params: { id: string; userId: string; userEmail?: string | null; title?: string; meta?: any; aiAnalyzed?: boolean }) {
  const serviceKey = getServiceKey();
  if (!serviceKey) throw new Error('Supabase env not configured (SUPABASE_SERVICE_ROLE_KEY)');

  const payload = {
    id: params.id,
    user_id: params.userId,
    user_email: params.userEmail ?? null,
    title: params.title ?? null,
    meta: params.meta ?? {},
    ai_analyzed: params.aiAnalyzed ?? false,
  };

  const res = await supabaseFetch('/rest/v1/call_sessions', {
    method: 'POST',
    headers: buildHeaders(serviceKey),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to create call session (${res.status}): ${text || res.statusText}`);
  }
}

export async function endCallSession(params: { id: string }) {
  const serviceKey = getServiceKey();
  if (!serviceKey) throw new Error('Supabase env not configured (SUPABASE_SERVICE_ROLE_KEY)');

  const ended_at = new Date().toISOString();
  const res = await supabaseFetch(`/rest/v1/call_sessions?id=eq.${encodeURIComponent(params.id)}`, {
    method: 'PATCH',
    headers: buildHeaders(serviceKey),
    body: JSON.stringify({ ended_at }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to end call session (${res.status}): ${text || res.statusText}`);
  }
}

export type TranscriptChunkRow = {
  session_id: string;
  user_id: string;
  seq: number;
  speaker: string;
  text: string;
};

export async function insertTranscriptChunks(rows: TranscriptChunkRow[]) {
  if (!rows || rows.length === 0) return;
  const serviceKey = getServiceKey();
  if (!serviceKey) throw new Error('Supabase env not configured (SUPABASE_SERVICE_ROLE_KEY)');

  // Idempotent on retry: ignore duplicates on (session_id, seq)
  const res = await supabaseFetch('/rest/v1/call_transcript_chunks?on_conflict=session_id,seq', {
    method: 'POST',
    headers: {
      ...buildHeaders(serviceKey),
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to insert transcript chunks (${res.status}): ${text || res.statusText}`);
  }
}

export type CallSessionSummaryRow = {
  session_id: string;
  user_id: string;
  user_email?: string | null;
  status: 'progressive' | 'final';
  title?: string | null;
  preview?: string | null;
  summary: any;
  duration_seconds?: number | null;
  model?: string | null;
};

export async function insertCallSessionSummary(row: CallSessionSummaryRow) {
  const serviceKey = getServiceKey();
  if (!serviceKey) throw new Error('Supabase env not configured (SUPABASE_SERVICE_ROLE_KEY)');

  const payload = {
    session_id: row.session_id,
    user_id: row.user_id,
    user_email: row.user_email ?? null,
    status: row.status,
    title: row.title ?? null,
    preview: row.preview ?? null,
    summary: row.summary ?? {},
    duration_seconds: row.duration_seconds ?? null,
    model: row.model ?? null,
    updated_at: new Date().toISOString(),
  };

  const res = await supabaseFetch('/rest/v1/call_session_summaries', {
    method: 'POST',
    headers: {
      ...buildHeaders(serviceKey),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to insert call session summary (${res.status}): ${text || res.statusText}`);
  }
}

export type StoredTranscriptChunk = {
  seq: number;
  speaker: string;
  text: string;
  created_at?: string;
};

export async function fetchTranscriptChunksForSession(params: { sessionId: string; limit?: number }): Promise<StoredTranscriptChunk[]> {
  const serviceKey = getServiceKey();
  if (!serviceKey) throw new Error('Supabase env not configured (SUPABASE_SERVICE_ROLE_KEY)');

  const all: StoredTranscriptChunk[] = [];
  const pageSize = Math.max(50, Math.min(1000, params.limit ?? 1000));
  let offset = 0;

  while (true) {
    const q =
      `/rest/v1/call_transcript_chunks` +
      `?session_id=eq.${encodeURIComponent(params.sessionId)}` +
      `&select=seq,speaker,text,created_at` +
      `&order=seq.asc` +
      `&limit=${pageSize}` +
      `&offset=${offset}`;

    const res = await supabaseFetch(q, {
      method: 'GET',
      headers: buildHeaders(serviceKey),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to fetch transcript chunks (${res.status}): ${text || res.statusText}`);
    }

    const page = (await res.json()) as StoredTranscriptChunk[];
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
    // Safety cap to avoid runaway loops
    if (offset > 100000) break;
  }

  return all;
}
