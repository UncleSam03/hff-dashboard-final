-- ============================================================
-- HFF Dashboard V2 — Full Database Schema
-- ============================================================

-- NOTE: If you already have a 'registrations' table, run this migration:
-- ALTER TABLE public.registrations 
-- ADD COLUMN IF NOT EXISTS education text,
-- ADD COLUMN IF NOT EXISTS marital_status text,
-- ADD COLUMN IF NOT EXISTS facilitator_uuid uuid,
-- ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
-- NOTIFY pgrst, 'reload schema';

-- =========================
-- 1. Profiles (Role System)
-- =========================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text check (role in ('admin', 'facilitator', 'participant')) not null default 'participant',
  full_name text,
  phone text,
  age integer,
  gender text,
  education text,
  marital_status text,
  place text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Enable insert for auth trigger" on public.profiles
  for insert with check (auth.uid() = id);

-- Admins can read all profiles (for management)
create policy "Admins can view all profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger as $$
declare
  first_name_val text;
  last_name_val text;
  full_name_val text;
begin
  full_name_val := coalesce(new.raw_user_meta_data->>'full_name', '');
  
  -- Simple split for full name
  if position(' ' in full_name_val) > 0 then
    first_name_val := split_part(full_name_val, ' ', 1);
    last_name_val := substring(full_name_val from position(' ' in full_name_val) + 1);
  else
    first_name_val := full_name_val;
    last_name_val := '';
  end if;

  -- 1. Insert into profiles
  insert into public.profiles (id, role, full_name, phone, age, gender, education, marital_status, place)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'participant'),
    full_name_val,
    coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
    (new.raw_user_meta_data->>'age')::integer,
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'education',
    new.raw_user_meta_data->>'marital_status',
    new.raw_user_meta_data->>'place'
  );

  -- 2. If facilitator, insert into registrations
  if (new.raw_user_meta_data->>'role') = 'facilitator' then
    insert into public.registrations (
      uuid, 
      first_name, 
      last_name, 
      age, 
      gender, 
      contact, 
      place, 
      education, 
      marital_status, 
      type, 
      facilitator_uuid,
      source
    )
    values (
      new.id,
      first_name_val,
      last_name_val,
      (new.raw_user_meta_data->>'age')::integer,
      new.raw_user_meta_data->>'gender',
      coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
      new.raw_user_meta_data->>'place',
      new.raw_user_meta_data->>'education',
      new.raw_user_meta_data->>'marital_status',
      'facilitator',
      new.id,
      'facilitator-signup'
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Drop the trigger if it exists, then recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =========================
-- 2. Registrations
-- =========================
create table if not exists public.registrations (
  id uuid default gen_random_uuid() primary key,
  uuid uuid unique not null,
  first_name text not null,
  last_name text not null,
  age integer,
  gender text check (gender in ('M', 'F')),
  contact text,
  place text,
  education text,
  marital_status text,
  type text check (type in ('facilitator', 'participant')),
  participants_count integer,
  books_distributed integer,
  facilitator_uuid uuid,
  attendance jsonb,
  source text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.registrations enable row level security;

create policy "Enable insert for all users"
on public.registrations
for insert
with check (true);

create policy "Enable read access for all users"
on public.registrations
for select
using (true);

create policy "Enable update for all users"
on public.registrations
for update
using (true);


-- =========================
-- 3. Testimonies
-- =========================
create table if not exists public.testimonies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.testimonies enable row level security;

create policy "Users can insert own testimony" on public.testimonies
  for insert with check (auth.uid() = user_id);

create policy "Users can view own testimonies" on public.testimonies
  for select using (auth.uid() = user_id);

-- Admins can view all testimonies
create policy "Admins can view all testimonies" on public.testimonies
  for select using (
    exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );
