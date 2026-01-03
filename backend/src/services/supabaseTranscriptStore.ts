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

export async function createCallSession(params: { id: string; userId: string; userEmail?: string | null; title?: string; meta?: any }) {
  const serviceKey = getServiceKey();
  if (!serviceKey) throw new Error('Supabase env not configured (SUPABASE_SERVICE_ROLE_KEY)');

  const payload = {
    id: params.id,
    user_id: params.userId,
    user_email: params.userEmail ?? null,
    title: params.title ?? null,
    meta: params.meta ?? {},
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

