-- Target schema for Supabase. The pilot app enforces the same rules in the
-- TypeScript domain layer and does not ship a service-role key.
-- Writes from the mobile client go through security-definer functions, not
-- direct table grants.

create extension if not exists postgis;
create extension if not exists pgcrypto;

create table public.cities (
  id text primary key,
  name text not null,
  country_code char(2) not null,
  timezone text not null,
  boundary geography(MultiPolygon, 4326),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'user' check (role in ('user', 'moderator')),
  reputation_score integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities (id),
  name text not null,
  category text not null,
  address text not null default '',
  location geography(Point, 4326) not null,
  status text not null default 'active' check (status in ('active', 'closed_permanently', 'under_review')),
  schedule_known boolean not null default false,
  hours_source text check (hours_source in ('external_provider', 'community', 'verified_owner', 'moderator')),
  hours_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_location_idx on public.businesses using gist (location);
create index businesses_city_category_idx on public.businesses (city_id, category);

create table public.business_sources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null,
  external_id text not null,
  last_seen_at timestamptz not null,
  attribution text,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  opens_at text not null,
  closes_at text not null,
  source text not null check (source in ('external_provider', 'community', 'verified_owner', 'moderator')),
  version integer not null,
  created_at timestamptz not null default now()
);

create index opening_hours_current_idx on public.opening_hours (business_id, version);

create table public.special_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  date date not null,
  is_closed boolean not null,
  opens_at text,
  closes_at text,
  reason text,
  valid_from timestamptz,
  valid_until timestamptz,
  created_by uuid references public.profiles (id),
  source text not null check (source in ('external_provider', 'community', 'verified_owner', 'moderator')),
  created_at timestamptz not null default now()
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  type text not null check (type in (
    'status_confirmation', 'weekly_hours', 'temporary_closure', 'extraordinary_opening', 'report_incorrect'
  )),
  payload jsonb not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  decision_reason text
);

create index contributions_business_idx on public.contributions (business_id, created_at desc);
create index contributions_user_idx on public.contributions (user_id, created_at desc);

create table public.business_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  verification_method text not null check (verification_method in ('document', 'business_contact', 'manual_review')),
  note text,
  status text not null check (status in ('pending', 'verified', 'rejected', 'revoked')),
  verified_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create unique index business_claims_one_verified_idx
  on public.business_claims (business_id)
  where status = 'verified';

create unique index business_claims_one_open_request_idx
  on public.business_claims (business_id, user_id)
  where status in ('pending', 'verified');

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_sources enable row level security;
alter table public.opening_hours enable row level security;
alter table public.special_hours enable row level security;
alter table public.contributions enable row level security;
alter table public.business_claims enable row level security;
alter table public.audit_log enable row level security;

create or replace function public.is_moderator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'moderator'
  );
$$;

grant select on public.cities, public.businesses, public.business_sources, public.opening_hours, public.special_hours
  to anon, authenticated;

create policy cities_read on public.cities for select using (true);
create policy businesses_read on public.businesses for select using (true);
create policy sources_read on public.business_sources for select using (true);
create policy hours_read on public.opening_hours for select using (true);
create policy specials_read on public.special_hours for select using (true);

create policy profiles_read_self on public.profiles
  for select using (id = auth.uid() or public.is_moderator(auth.uid()));

create policy contributions_read on public.contributions
  for select using (user_id = auth.uid() or public.is_moderator(auth.uid()));

create policy claims_read on public.business_claims
  for select using (user_id = auth.uid() or public.is_moderator(auth.uid()));

create policy audit_read_moderator on public.audit_log
  for select using (public.is_moderator(auth.uid()));

-- No insert/update policies for businesses, hours, claims status or contributions.
-- Clients call reviewed functions so a user cannot self-assign owner or moderator.
revoke insert, update, delete on public.businesses, public.opening_hours, public.special_hours,
  public.contributions, public.business_claims, public.audit_log, public.business_sources
  from anon, authenticated;
