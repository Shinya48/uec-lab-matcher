(() => {
  "use strict";

  const STORAGE_KEY = "uecLabMatcherResponsesV2";
  const LEGACY_STORAGE_KEY = "uecLabMatcherResponsesV1";
  const TABLE_NAME = "lab_matcher_responses";
  const config = window.LAB_MATCHER_CONFIG || {};

  function isCloudConfigured() {
    return Boolean(
      typeof config.supabaseUrl === "string" &&
      config.supabaseUrl.startsWith("https://") &&
      typeof config.supabasePublishableKey === "string" &&
      config.supabasePublishableKey.trim().length > 10
    );
  }

  function cleanUrl(url) {
    return String(url || "").replace(/\/+$/, "");
  }

  function makeId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function normalizeResponse(item) {
    if (!item || !Number.isFinite(Number(item.x)) || !Number.isFinite(Number(item.y))) {
      return null;
    }

    return {
      id: String(item.id || item.response_key || makeId()),
      x: Math.max(-100, Math.min(100, Math.round(Number(item.x)))),
      y: Math.max(-100, Math.min(100, Math.round(Number(item.y)))),
      tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 3) : [],
      answeredAt: item.answeredAt || item.created_at || new Date().toISOString(),
      synced: Boolean(item.synced || item.created_at),
      source: item.source || (item.created_at ? "cloud" : "local")
    };
  }

  function readArray(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`localStorage (${key}) の読み込みに失敗しました。`, error);
      return [];
    }
  }

  function loadLocalResponses() {
    const current = readArray(STORAGE_KEY);
    const legacy = current.length === 0 ? readArray(LEGACY_STORAGE_KEY) : [];
    const source = current.length > 0 ? current : legacy;
    const normalized = source.map(normalizeResponse).filter(Boolean);

    if (legacy.length > 0) {
      writeLocalResponses(normalized);
    }

    return normalized;
  }

  function writeLocalResponses(responses) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(responses.slice(-500)));
      return true;
    } catch (error) {
      console.warn("端末内への回答保存に失敗しました。", error);
      return false;
    }
  }

  function upsertLocalResponse(response) {
    const normalized = normalizeResponse(response);
    if (!normalized) return false;

    const current = loadLocalResponses();
    const index = current.findIndex(item => item.id === normalized.id);
    if (index >= 0) current[index] = { ...current[index], ...normalized };
    else current.push(normalized);
    return writeLocalResponses(current);
  }

  function markSynced(id) {
    const current = loadLocalResponses();
    const target = current.find(item => item.id === id);
    if (!target) return;
    target.synced = true;
    target.source = "cloud";
    writeLocalResponses(current);
  }

  function clearLocalResponses() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutMs = Number(config.requestTimeoutMs) || 6000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  function apiHeaders(extra = {}) {
    const key = String(config.supabasePublishableKey || "").trim();
    const headers = { apikey: key, ...extra };

    // 旧 anon key はJWTなので Authorization にも設定します。
    // 新しい sb_publishable_* key は apikey ヘッダーだけで使用します。
    if (!key.startsWith("sb_publishable_")) {
      headers.Authorization = `Bearer ${key}`;
    }

    return headers;
  }

  function cloudEndpoint(query = "") {
    const base = `${cleanUrl(config.supabaseUrl)}/rest/v1/${TABLE_NAME}`;
    return query ? `${base}?${query}` : base;
  }

  async function uploadResponse(response) {
    if (!isCloudConfigured()) {
      return { ok: false, skipped: true, error: null };
    }

    const body = {
      response_key: response.id,
      event_code: String(config.eventCode || "uec-open-campus-2026"),
      x: response.x,
      y: response.y
    };

    try {
      const result = await fetchWithTimeout(cloudEndpoint(), {
        method: "POST",
        headers: apiHeaders({
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify(body)
      });

      if (!result.ok) {
        const message = await result.text();
        // 同じresponse_keyをオフライン再送した場合は、既に保存済みとして扱います。
        if (result.status !== 409 || !message.includes("23505")) {
          throw new Error(`Supabase保存エラー (${result.status}): ${message}`);
        }
      }

      markSynced(response.id);
      return { ok: true, skipped: false, error: null };
    } catch (error) {
      console.warn("共有データベースへの保存に失敗しました。端末内保存を使用します。", error);
      return { ok: false, skipped: false, error };
    }
  }

  async function saveResponse(response) {
    const normalized = normalizeResponse({ ...response, synced: false, source: "local" });
    if (!normalized) {
      return { saved: false, source: "none", error: new Error("回答データが不正です。") };
    }

    const localSaved = upsertLocalResponse(normalized);
    const cloudResult = await uploadResponse(normalized);

    if (cloudResult.ok) {
      return { saved: true, source: "cloud", error: null };
    }

    return {
      saved: localSaved,
      source: localSaved ? "local" : "none",
      error: cloudResult.error
    };
  }

  async function syncPendingResponses() {
    if (!isCloudConfigured()) return { synced: 0, failed: 0 };

    const pending = loadLocalResponses().filter(item => !item.synced);
    let synced = 0;
    let failed = 0;

    for (const response of pending) {
      const result = await uploadResponse(response);
      if (result.ok) synced += 1;
      else failed += 1;
    }

    return { synced, failed };
  }

  async function loadCloudResponses() {
    if (!isCloudConfigured()) {
      return { responses: [], error: null, skipped: true };
    }

    const eventCode = encodeURIComponent(String(config.eventCode || "uec-open-campus-2026"));
    const limit = Math.max(1, Math.min(5000, Number(config.maxSharedResponses) || 1000));
    const query = [
      "select=response_key,x,y,created_at",
      `event_code=eq.${eventCode}`,
      "order=created_at.desc",
      `limit=${limit}`
    ].join("&");

    try {
      const result = await fetchWithTimeout(cloudEndpoint(query), {
        headers: apiHeaders({ Accept: "application/json" })
      });

      if (!result.ok) {
        const message = await result.text();
        throw new Error(`Supabase読込エラー (${result.status}): ${message}`);
      }

      const rows = await result.json();
      return {
        responses: Array.isArray(rows) ? rows.map(normalizeResponse).filter(Boolean) : [],
        error: null,
        skipped: false
      };
    } catch (error) {
      console.warn("共有回答の読み込みに失敗しました。端末内データへ切り替えます。", error);
      return { responses: [], error, skipped: false };
    }
  }

  function mergeResponses(cloud, local) {
    const byId = new Map();
    [...cloud, ...local].forEach(item => {
      const normalized = normalizeResponse(item);
      if (!normalized) return;
      if (!byId.has(normalized.id) || normalized.source === "cloud") {
        byId.set(normalized.id, normalized);
      }
    });
    return [...byId.values()];
  }

  async function loadComparisonResponses() {
    const local = loadLocalResponses();

    if (!isCloudConfigured()) {
      return {
        responses: local,
        mode: "local",
        error: null,
        localCount: local.length,
        cloudCount: 0
      };
    }

    await syncPendingResponses();
    const cloudResult = await loadCloudResponses();

    if (cloudResult.error) {
      return {
        responses: local,
        mode: "local-fallback",
        error: cloudResult.error,
        localCount: local.length,
        cloudCount: 0
      };
    }

    const merged = mergeResponses(cloudResult.responses, local.filter(item => !item.synced));
    return {
      responses: merged,
      mode: "cloud",
      error: null,
      localCount: local.length,
      cloudCount: cloudResult.responses.length
    };
  }

  window.LabMatcherDataService = Object.freeze({
    isCloudConfigured,
    loadLocalResponses,
    loadComparisonResponses,
    saveResponse,
    syncPendingResponses,
    clearLocalResponses
  });
})();
