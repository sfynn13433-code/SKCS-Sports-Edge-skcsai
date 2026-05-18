begin;

create table if not exists public.f1_teams (
  id bigserial primary key,
  key text not null unique,
  name text not null,
  country_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.f1_tracks (
  id bigserial primary key,
  key text not null unique,
  name text not null,
  city text,
  country_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.f1_persons (
  id bigserial primary key,
  key text not null unique,
  first_name text,
  last_name text,
  code text,
  date_of_birth date,
  country_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.f1_races (
  id bigserial primary key,
  season integer not null,
  round integer,
  name text not null,
  date timestamptz,
  track_id bigint references public.f1_tracks(id) on delete set null,
  status text,
  raw_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(season, round)
);

create table if not exists public.f1_rosters (
  id bigserial primary key,
  season integer not null,
  team_id bigint references public.f1_teams(id) on delete cascade,
  person_id bigint references public.f1_persons(id) on delete cascade,
  car_number text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(season, team_id, person_id)
);

create table if not exists public.f1_results (
  id bigserial primary key,
  race_id bigint references public.f1_races(id) on delete cascade,
  position integer,
  person_id bigint references public.f1_persons(id) on delete set null,
  team_id bigint references public.f1_teams(id) on delete set null,
  laps integer,
  time_text text,
  time_ms bigint,
  status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(race_id, person_id)
);

create index if not exists idx_f1_races_season_date on public.f1_races(season, date);
create index if not exists idx_f1_results_race on public.f1_results(race_id);

commit;
