-- =============================================================================
-- Planitary — Profile self-service (Account page)
-- The `on_auth_user_created` trigger already creates a profile row for every
-- new user, so this migration only adds the pieces the Account page needs
-- defensively:
--   1. An insert policy, so an upsert from the client can safely recreate a
--      profile row if it were ever missing (RLS still restricts it to the
--      caller's own id).
--   2. A server-side length guard on `display_name`, matching the Account
--      page's max length so the limit is enforced even outside the app.
-- =============================================================================

create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) <= 50);
