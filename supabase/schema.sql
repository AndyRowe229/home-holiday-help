-- Home Holiday Help booking app: run this once in Supabase → SQL Editor.

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_email text not null,
  booking_date date not null,
  service text not null check (service in ('babysitting', 'dogs')),
  sitter text not null check (sitter in ('Sienna', 'Lyla', 'Sophie')),
  children int check (children between 1 and 20),
  dogs int check (dogs between 1 and 10),
  hours numeric(4, 1) not null check (hours > 0 and hours <= 24),
  allergies text,
  extra_info text
);

-- Each sitter takes one booking per day.
create unique index if not exists bookings_one_per_sitter_per_day
  on public.bookings (sitter, booking_date);

-- Customers can only read their own bookings. New bookings are only
-- created by the server (which picks the sitter), never directly by customers.
alter table public.bookings enable row level security;

drop policy if exists "Customers can read their own bookings" on public.bookings;
create policy "Customers can read their own bookings"
  on public.bookings for select
  to authenticated
  using (auth.uid() = user_id);
