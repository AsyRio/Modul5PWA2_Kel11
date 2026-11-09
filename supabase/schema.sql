-- ============================================================================
-- Skema database Bore & Barrel — jalankan SEKALI di project Supabase MILIK
-- SENDIRI: Dashboard → SQL Editor → New query → paste → Run.
--
-- Supabase otomatis membuat REST API (PostgREST) dari tabel-tabel ini:
--   GET/POST/PATCH/DELETE  {SUPABASE_URL}/rest/v1/products | favorites | reviews
-- ============================================================================

-- ---------- products --------------------------------------------------------
create table if not exists public.products (
  id          bigint generated always as identity primary key,
  name        text        not null,
  type        text        not null default 'Pistol',      -- Pistol | Rifle | Shotgun
  caliber     text        not null default '9mm',
  price       numeric     not null default 0 check (price >= 0),
  description text        not null default '',
  specs       text[]      not null default '{}',           -- "Nama: nilai"
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index untuk filter kategori & urutan default (membantu paginasi)
create index if not exists products_type_idx       on public.products (type);
create index if not exists products_created_at_idx on public.products (created_at desc);

-- ---------- favorites (per-perangkat, user_id = UUID acak di localStorage) --
create table if not exists public.favorites (
  id          bigint generated always as identity primary key,
  product_id  bigint      not null references public.products (id) on delete cascade,
  user_id     uuid        not null,
  created_at  timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists favorites_user_idx on public.favorites (user_id);

-- ---------- reviews ---------------------------------------------------------
create table if not exists public.reviews (
  id          bigint generated always as identity primary key,
  product_id  bigint      not null references public.products (id) on delete cascade,
  user_id     uuid        not null,
  rating      int         not null check (rating between 1 and 5),
  comment     text        not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists reviews_product_idx on public.reviews (product_id, created_at desc);

-- ---------- Row Level Security ---------------------------------------------
-- Aplikasi ini tanpa login (anonim), jadi policy mengizinkan role `anon`
-- membaca & menulis. Untuk produksi sungguhan, ganti dengan Supabase Auth.
alter table public.products  enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews   enable row level security;

drop policy if exists "anon all products"  on public.products;
drop policy if exists "anon all favorites" on public.favorites;
drop policy if exists "anon all reviews"   on public.reviews;

create policy "anon all products"  on public.products  for all to anon using (true) with check (true);
create policy "anon all favorites" on public.favorites for all to anon using (true) with check (true);
create policy "anon all reviews"   on public.reviews   for all to anon using (true) with check (true);

-- ---------- Storage: bucket gambar produk (publik) --------------------------
insert into storage.buckets (id, name, public)
values ('guns', 'guns', true)
on conflict (id) do nothing;

drop policy if exists "anon upload guns" on storage.objects;
drop policy if exists "anon read guns"   on storage.objects;
create policy "anon upload guns" on storage.objects for insert to anon with check (bucket_id = 'guns');
create policy "anon read guns"   on storage.objects for select to anon using (bucket_id = 'guns');

-- ---------- Data contoh (cukup untuk memperlihatkan paginasi: 12 item) ------
insert into public.products (name, type, caliber, price, description, specs, image_url)
select * from (values
  ('Glock 17',        'Pistol',  '9mm',      599,  'The duty pistol everything else is measured against. Polymer frame, 17-round magazine, striker-fired trigger.', array['Capacity: 17 rounds','Action: Striker-fired'], '/guns/pistol.svg'),
  ('AK-47',           'Rifle',   '7.62mm',   899,  'Gas-operated, loose tolerances, and famously indifferent to mud. Seven decades of service.',                     array['Capacity: 30 rounds','Action: Gas-operated'],  '/guns/rifle.svg'),
  ('Remington 870',   'Shotgun', '12 Gauge', 449,  'Pump-action workhorse. Five shells in the tube and a receiver that has taken more abuse than most trucks.',       array['Capacity: 5 shells','Action: Pump'],           '/guns/shotgun.svg'),
  ('AR-15',           'Rifle',   '5.56mm',   799,  'Light-recoiling, endlessly modular, and accurate well past the range most shooters can hold.',                    array['Capacity: 30 rounds','Action: Direct impingement'], '/guns/rifle.svg'),
  ('Desert Eagle',    'Pistol',  '.50 AE',   1599, 'Gas-operated hand cannon. Three and a half pounds of chromed steel. Subtle it is not.',                           array['Capacity: 7 rounds','Action: Gas-operated'],   '/guns/pistol.svg'),
  ('Mossberg 500',    'Shotgun', '12 Gauge', 399,  'The other pump gun. Twin action bars, a simple tang safety, and a price that leaves money for ammunition.',         array['Capacity: 6 shells','Action: Pump'],           '/guns/shotgun.svg'),
  ('Beretta 92FS',    'Pistol',  '9mm',      649,  'Open-slide Italian classic with a smooth double-action trigger and an ambidextrous safety.',                       array['Capacity: 15 rounds','Action: DA/SA'],         '/guns/pistol.svg'),
  ('SIG P320',        'Pistol',  '9mm',      579,  'Modular striker-fired pistol: swap the grip module and it becomes a different size entirely.',                    array['Capacity: 17 rounds','Action: Striker-fired'], '/guns/pistol.svg'),
  ('M1 Garand',       'Rifle',   '.30-06',   1099, 'Semi-automatic battle rifle of the 1940s, loaded with the unmistakable en-bloc clip and its famous ping.',        array['Capacity: 8 rounds','Action: Gas-operated'],   '/guns/rifle.svg'),
  ('Ruger 10/22',     'Rifle',   '.22 LR',   319,  'The plinking standard. Light, cheap to feed, and the most customizable rimfire ever made.',                       array['Capacity: 10 rounds','Action: Blowback'],      '/guns/rifle.svg'),
  ('Benelli M4',      'Shotgun', '12 Gauge', 1899, 'Gas-operated semi-auto tactical shotgun with a self-regulating piston and a reputation for reliability.',         array['Capacity: 5 shells','Action: Semi-auto'],      '/guns/shotgun.svg'),
  ('Colt 1911',       'Pistol',  '.45 ACP',  849,  'John Browning''s single-action classic. Over a century old and still the shape most people picture.',              array['Capacity: 7 rounds','Action: Single-action'],  '/guns/pistol.svg')
) as v(name, type, caliber, price, description, specs, image_url)
where not exists (select 1 from public.products);
