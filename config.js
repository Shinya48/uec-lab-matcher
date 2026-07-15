/**
 * 研究室マッチングシステムの接続設定。
 * Supabaseを使わない間は supabaseUrl / supabasePublishableKey を空欄のままにしてください。
 *
 * 注意：ブラウザに置いてよいのは Publishable key（または旧 anon key）だけです。
 * Secret key / service_role key は絶対に記載しないでください。
 */
window.LAB_MATCHER_CONFIG = Object.freeze({
  supabaseUrl: "https://xakutgocpqiqcliodewm.supabase.co",
  supabasePublishableKey: "sb_publishable_iZA4_uCxIPm71xLnPTPJWg_rb9gMmgl",
  eventCode: "uec-open-campus-2026",
  useDemoData: true,
  maxSharedResponses: 1000,
  requestTimeoutMs: 6000
});
