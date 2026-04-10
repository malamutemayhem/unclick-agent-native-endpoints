-- Tenant isolation for webhook bins
--
-- Add key_id to webhook_bins so that each bin is tied to the specific API key
-- that created it. Without this column, any key in the same org could read
-- another key's captured webhook data (CRITICAL security finding).
--
-- The column is nullable so that existing rows (created before this migration)
-- are not broken. The application treats NULL key_id as "org-scoped" for
-- backward compatibility, and all new bins will have key_id set.

alter table webhook_bins
  add column if not exists key_id text references api_keys(id) on delete set null;

create index if not exists webhook_bins_key_idx on webhook_bins (key_id);
