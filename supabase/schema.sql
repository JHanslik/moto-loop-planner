-- ===========================================================================
-- Moto Loop Planner — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Requires PostgreSQL 15+ (for security_invoker views) — all Supabase projects
-- created in the last couple of years qualify.
-- ===========================================================================

-- 1. PROFILES ----------------------------------------------------------------
-- This is the prompt's "users" table. It is 1:1 with Supabase's managed
-- auth.users table and is auto-populated by a trigger on sign-up.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. RIDES -------------------------------------------------------------------
create table if not exists public.rides (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  name          text not null,
  distance_km   numeric not null,
  duration_min  integer not null,
  route_geojson jsonb not null,
  score         integer not null default 0,
  is_public     boolean not null default false,
  rating        integer check (rating between 1 and 5),
  style         text check (style in ('SPORT', 'SCENIC', 'CHILL')),
  start_name    text,
  created_at    timestamptz not null default now()
);
create index if not exists rides_user_id_idx on public.rides (user_id);
create index if not exists rides_public_idx on public.rides (is_public) where is_public;

-- 3. LIKES -------------------------------------------------------------------
create table if not exists public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  ride_id    uuid not null references public.rides (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ride_id)
);

-- 4. COMMENTS ----------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  ride_id    uuid not null references public.rides (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_ride_id_idx on public.comments (ride_id);

-- 5. RIDE GROUPS (Group Ride) ------------------------------------------------
create table if not exists public.ride_groups (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  invite_code    text not null unique,
  leader_id      uuid not null references public.profiles (id) on delete cascade,
  ride_id        uuid references public.rides (id) on delete set null,
  route_geojson  jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists ride_groups_leader_idx on public.ride_groups (leader_id);
create index if not exists ride_groups_invite_idx on public.ride_groups (invite_code);

create table if not exists public.group_members (
  group_id           uuid not null references public.ride_groups (id) on delete cascade,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  role               text not null default 'member' check (role in ('leader', 'member')),
  sharing_location   boolean not null default false,
  joined_at          timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

-- 6. ROW LEVEL SECURITY ------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.rides         enable row level security;
alter table public.likes         enable row level security;
alter table public.comments      enable row level security;
alter table public.ride_groups   enable row level security;
alter table public.group_members enable row level security;

-- profiles: world-readable, self-writable
drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all"
  on public.profiles for select using (true);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update using (auth.uid() = id);

-- rides: public ones (or your own) are readable; you can only write your own
drop policy if exists "public or own rides readable" on public.rides;
create policy "public or own rides readable"
  on public.rides for select using (is_public or auth.uid() = user_id);
drop policy if exists "insert own rides" on public.rides;
create policy "insert own rides"
  on public.rides for insert with check (auth.uid() = user_id);
drop policy if exists "update own rides" on public.rides;
create policy "update own rides"
  on public.rides for update using (auth.uid() = user_id);
drop policy if exists "delete own rides" on public.rides;
create policy "delete own rides"
  on public.rides for delete using (auth.uid() = user_id);

-- likes: readable by all, writable for yourself
drop policy if exists "likes readable by all" on public.likes;
create policy "likes readable by all"
  on public.likes for select using (true);
drop policy if exists "insert own likes" on public.likes;
create policy "insert own likes"
  on public.likes for insert with check (auth.uid() = user_id);
drop policy if exists "delete own likes" on public.likes;
create policy "delete own likes"
  on public.likes for delete using (auth.uid() = user_id);

-- comments: readable by all, writable for yourself
drop policy if exists "comments readable by all" on public.comments;
create policy "comments readable by all"
  on public.comments for select using (true);
drop policy if exists "insert own comments" on public.comments;
create policy "insert own comments"
  on public.comments for insert with check (auth.uid() = user_id);
drop policy if exists "delete own comments" on public.comments;
create policy "delete own comments"
  on public.comments for delete using (auth.uid() = user_id);

-- RLS helpers (SECURITY DEFINER avoids infinite recursion when policies query group_members)
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_leader(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.ride_groups
    where id = p_group_id and leader_id = auth.uid()
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_leader(uuid) to authenticated;

-- ride_groups: members read; anyone can read active groups by invite code; leader manages
drop policy if exists "group members can read group" on public.ride_groups;
create policy "group members can read group"
  on public.ride_groups for select using (public.is_group_member(id));
drop policy if exists "read group by invite code" on public.ride_groups;
create policy "read group by invite code"
  on public.ride_groups for select using (is_active = true);
drop policy if exists "authenticated users can create groups" on public.ride_groups;
create policy "authenticated users can create groups"
  on public.ride_groups for insert with check (auth.uid() = leader_id);
drop policy if exists "leader can update group" on public.ride_groups;
create policy "leader can update group"
  on public.ride_groups for update using (auth.uid() = leader_id);
drop policy if exists "leader can delete group" on public.ride_groups;
create policy "leader can delete group"
  on public.ride_groups for delete using (auth.uid() = leader_id);

-- group_members: members see each other; self-join; self-update sharing; leave or leader kick
drop policy if exists "members can read membership" on public.group_members;
create policy "members can read membership"
  on public.group_members for select using (public.is_group_member(group_id));
drop policy if exists "users can join groups" on public.group_members;
create policy "users can join groups"
  on public.group_members for insert with check (auth.uid() = user_id);
drop policy if exists "users can update own membership" on public.group_members;
create policy "users can update own membership"
  on public.group_members for update using (auth.uid() = user_id);
drop policy if exists "users can leave groups" on public.group_members;
create policy "users can leave groups"
  on public.group_members for delete using (
    auth.uid() = user_id or public.is_group_leader(group_id)
  );

-- 7. FEED VIEW ---------------------------------------------------------------
-- Rides enriched with author name + like/comment counts. security_invoker = on
-- makes the view honor the querying user's RLS (so private rides stay private).
create or replace view public.ride_feed
with (security_invoker = on) as
select
  r.*,
  p.name as author_name,
  (select count(*) from public.likes l    where l.ride_id = r.id) as like_count,
  (select count(*) from public.comments c where c.ride_id = r.id) as comment_count
from public.rides r
left join public.profiles p on p.id = r.user_id;

-- 8. GRANTS ------------------------------------------------------------------
-- Supabase usually sets these via default privileges, but we make them explicit
-- so the schema works regardless of project age. RLS still governs every row.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.rides, public.likes, public.comments,
  public.ride_groups, public.group_members to anon, authenticated;
grant insert, update, delete on public.rides, public.likes, public.comments to authenticated;
grant insert, update, delete on public.ride_groups, public.group_members to authenticated;
grant update on public.profiles to authenticated;
grant select on public.ride_feed to anon, authenticated;
