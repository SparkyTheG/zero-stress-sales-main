type OpenAIPoolName = 'main' | 'aux';

type PoolState = {
  active: number;
  max: number;
  queue: Array<() => void>;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const POOLS: Record<OpenAIPoolName, PoolState> = {
  // Speed-first defaults. Override via env if you hit 429s:
  // OPENAI_POOL_MAIN_MAX=8 OPENAI_POOL_AUX_MAX=1
  main: {
    active: 0,
    max: parsePositiveInt(process.env.OPENAI_POOL_MAIN_MAX, 20),
    queue: [],
  },
  aux: {
    active: 0,
    max: parsePositiveInt(process.env.OPENAI_POOL_AUX_MAX, 1),
    queue: [],
  },
};

const DEBUG = process.env.DEBUG_LOGS === '1';

async function acquire(pool: OpenAIPoolName): Promise<() => void> {
  const p = POOLS[pool];
  if (p.active < p.max) {
    p.active += 1;
    if (DEBUG) console.log(`[OpenAI Pool] acquire ${pool} active=${p.active}/${p.max} q=${p.queue.length}`);
    return () => release(pool);
  }
  await new Promise<void>((resolve) => {
    p.queue.push(resolve);
    if (DEBUG) console.log(`[OpenAI Pool] queue ${pool} active=${p.active}/${p.max} q=${p.queue.length}`);
  });
  // We were dequeued; take a slot.
  p.active += 1;
  if (DEBUG) console.log(`[OpenAI Pool] acquire(dequeued) ${pool} active=${p.active}/${p.max} q=${p.queue.length}`);
  return () => release(pool);
}

function release(pool: OpenAIPoolName) {
  const p = POOLS[pool];
  p.active = Math.max(0, p.active - 1);
  const next = p.queue.shift();
  if (DEBUG) console.log(`[OpenAI Pool] release ${pool} active=${p.active}/${p.max} q=${p.queue.length}`);
  if (next) next();
}

export async function withOpenAIPool<T>(pool: OpenAIPoolName, fn: () => Promise<T>): Promise<T> {
  const releaseFn = await acquire(pool);
  try {
    return await fn();
  } finally {
    releaseFn();
  }
}

export function getOpenAIPoolStats(): Record<OpenAIPoolName, { active: number; max: number; queued: number }> {
  return {
    main: { active: POOLS.main.active, max: POOLS.main.max, queued: POOLS.main.queue.length },
    aux: { active: POOLS.aux.active, max: POOLS.aux.max, queued: POOLS.aux.queue.length },
  };
}

