-- Normalize existing Fishbowl message text, then prevent future Unicode dashes.
update public.mc_fishbowl_messages
set text = replace(replace(text, chr(8212), '-'), chr(8211), '-')
where text like '%' || chr(8212) || '%'
   or text like '%' || chr(8211) || '%';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mc_fishbowl_messages_no_unicode_dashes'
      and conrelid = 'public.mc_fishbowl_messages'::regclass
  ) then
    alter table public.mc_fishbowl_messages
      add constraint mc_fishbowl_messages_no_unicode_dashes
      check (
        position(chr(8212) in text) = 0
        and position(chr(8211) in text) = 0
      );
  end if;
end $$;
