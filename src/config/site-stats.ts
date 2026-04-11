export const SITE_STATS = {
  // Exact count of INSERT INTO platform_connectors across all Supabase migration files:
  // 20260410100000_keychain_mvp.sql           5
  // 20260410110000_keychain_extra_connectors.sql  14
  // 20260410120000_keychain_ai_video_connectors.sql  5
  // 20260410130000_keychain_batch_m.sql       10
  // 20260410140000_keychain_batch_n.sql       10
  // 20260410150000_keychain_batch_o.sql        9 new (notion is an ON CONFLICT update)
  // Total: 53
  BACKSTAGEPASS_PLATFORMS: 53,
};
