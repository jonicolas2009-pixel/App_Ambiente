-- =====================================================================
--  MAQNEX · Esquema de base de datos para Supabase (PostgreSQL)
--  Cómo usarlo: Supabase → SQL Editor → New query → pega TODO → Run.
--  Se puede volver a ejecutar sin perder datos (crea solo lo que falte).
--
--  Seguridad incluida en este archivo:
--   · Row Level Security (RLS) activado en TODAS las tablas.
--   · Permisos por columna: el navegador no puede cambiar campos
--     protegidos (rol, estado de la máquina, autor de un mensaje...).
--   · Las acciones delicadas pasan por funciones del servidor (RPC)
--     que validan quién llama y con qué datos.
--   · Restricciones CHECK en cada campo (longitudes, rangos, listas).
--   · Límite de mensajes por minuto (anti-spam).
--   · El usuario anónimo (sin sesión) no puede leer ni escribir nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
do $$ begin create type public.user_role as enum ('tecnico','supervisor','admin');
exception when duplicate_object then null; end $$;
do $$ begin create type public.machine_level as enum ('normal','proximo','recomendado','alta');
exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('abierta','en_progreso','cerrada');
exception when duplicate_object then null; end $$;
do $$ begin create type public.order_priority as enum ('baja','media','alta','critica');
exception when duplicate_object then null; end $$;
do $$ begin create type public.contact_status as enum ('pendiente','aceptado');
exception when duplicate_object then null; end $$;
do $$ begin
  create domain public.area_t as text
    check (value in ('Producción','Mantenimiento','Calidad','Logística','Servicios'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          text not null unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  full_name         text not null check (char_length(full_name) between 2 and 80),
  headline          text not null default '' check (char_length(headline) <= 120),
  about             text not null default '' check (char_length(about) <= 1000),
  area              public.area_t not null default 'Producción',
  role              public.user_role not null default 'tecnico',
  skills            text[] not null default '{}' check (cardinality(skills) <= 15),
  avatar_path       text check (avatar_path is null or avatar_path ~ ('^' || id::text || '/avatar-[0-9]{10,16}\.webp$')),
  terms_version     text,
  terms_accepted_at timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists public.machines (
  id                  bigint generated always as identity primary key,
  code                text not null unique check (code ~ '^[A-Z0-9-]{2,20}$'),
  name                text not null check (char_length(name) between 2 and 80),
  model               text not null default '' check (char_length(model) <= 80),
  stage               text not null check (stage in ('preparacion','llenado','etiquetado','servicios')),
  area                public.area_t not null default 'Producción',
  hours_total         numeric(10,1) not null default 0 check (hours_total >= 0 and hours_total <= 1000000),
  interval_hours      integer not null check (interval_hours between 10 and 20000),
  hours_since_service numeric(10,1) not null default 0 check (hours_since_service >= 0 and hours_since_service <= 1000000),
  temp_base           numeric(5,1) not null default 55 check (temp_base between 0 and 150),
  vib_base            numeric(5,2) not null default 2.5 check (vib_base between 0 and 20),
  last_temp           numeric(5,1),
  last_vib            numeric(5,2),
  last_reading_at     timestamptz,
  level               public.machine_level not null default 'normal',
  last_service_at     timestamptz,
  created_by          uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now()
);

create table if not exists public.sensor_readings (
  id           bigint generated always as identity primary key,
  machine_id   bigint not null references public.machines(id) on delete cascade,
  temperature  numeric(5,1) not null check (temperature between -20 and 200),
  vibration    numeric(5,2) not null check (vibration between 0 and 50),
  source       text not null default 'simulado' check (source in ('simulado','sensor')),
  recorded_at  timestamptz not null default now()
);
create index if not exists sensor_readings_machine_time on public.sensor_readings (machine_id, recorded_at desc);

create table if not exists public.machine_logs (
  id          bigint generated always as identity primary key,
  machine_id  bigint not null references public.machines(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  kind        text not null check (kind in ('horas','mantenimiento','orden','falla','alta')),
  value       numeric(10,1),
  note        text not null default '' check (char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists machine_logs_machine_time on public.machine_logs (machine_id, created_at desc);

create table if not exists public.failures (
  id              bigint generated always as identity primary key,
  machine_id      bigint not null references public.machines(id) on delete cascade,
  cause           text not null check (char_length(cause) between 3 and 200),
  downtime_hours  numeric(6,1) not null default 0 check (downtime_hours between 0 and 1000),
  cost            numeric(12,0) not null default 0 check (cost between 0 and 1000000000),
  occurred_at     timestamptz not null default now() check (occurred_at <= now() + interval '1 day'),
  reported_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists failures_machine on public.failures (machine_id, occurred_at desc);

create table if not exists public.parts (
  id          bigint generated always as identity primary key,
  sku         text not null unique check (sku ~ '^[A-Z0-9-]{2,20}$'),
  name        text not null check (char_length(name) between 2 and 80),
  stock       integer not null default 0 check (stock between 0 and 100000),
  min_stock   integer not null default 0 check (min_stock between 0 and 100000),
  unit_cost   numeric(12,0) not null default 0 check (unit_cost between 0 and 1000000000),
  created_at  timestamptz not null default now()
);

create table if not exists public.work_orders (
  id            bigint generated always as identity primary key,
  machine_id    bigint not null references public.machines(id) on delete cascade,
  title         text not null check (char_length(title) between 3 and 120),
  description   text not null default '' check (char_length(description) <= 1000),
  kind          text not null default 'preventiva' check (kind in ('preventiva','correctiva')),
  priority      public.order_priority not null default 'media',
  status        public.order_status not null default 'abierta',
  assignee      uuid references public.profiles(id) on delete set null,
  due_date      date,
  est_hours     numeric(5,1) not null default 1 check (est_hours between 0 and 500),
  real_hours    numeric(5,1) check (real_hours between 0 and 500),
  safety_steps  text[] not null default '{}' check (cardinality(safety_steps) <= 10),
  checklist     jsonb not null default '[]'::jsonb,
  part_id       bigint references public.parts(id) on delete set null,
  part_qty      integer not null default 0 check (part_qty between 0 and 1000),
  notes         text check (char_length(notes) <= 1000),
  cost          numeric(12,0) not null default 0 check (cost between 0 and 1000000000),
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  closed_at     timestamptz
);
create index if not exists work_orders_status on public.work_orders (status, priority);
create index if not exists work_orders_assignee on public.work_orders (assignee);

create table if not exists public.channels (
  id           bigint generated always as identity primary key,
  name         text not null check (char_length(name) between 2 and 40),
  area         public.area_t,
  description  text not null default '' check (char_length(description) <= 200),
  is_private   boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create unique index if not exists channels_name_unique on public.channels (lower(name));

create table if not exists public.channel_members (
  channel_id  bigint not null references public.channels(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  channel_id  bigint not null references public.channels(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_channel_time on public.messages (channel_id, created_at desc);
create index if not exists messages_author_time on public.messages (author_id, created_at desc);

create table if not exists public.contacts (
  requester   uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  addressee   uuid not null references public.profiles(id) on delete cascade,
  status      public.contact_status not null default 'pendiente',
  created_at  timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index if not exists contacts_addressee on public.contacts (addressee);

create table if not exists public.direct_messages (
  id            bigint generated always as identity primary key,
  sender_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists dm_pair_time on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists dm_recipient_unread on public.direct_messages (recipient_id) where read_at is null;

create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('falla','alerta','orden','contacto','stock','sistema')),
  title       text not null check (char_length(title) <= 120),
  body        text not null default '' check (char_length(body) <= 300),
  link        text check (link ~ '^#/[a-z0-9/_-]*$'),
  area        public.area_t,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_time on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. Funciones de apoyo (las usan las políticas RLS)
--    SECURITY DEFINER + search_path vacío para que nadie las secuestre.
-- ---------------------------------------------------------------------
create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('supervisor','admin') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.can_access_channel(p_channel bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channels c
    where c.id = p_channel
      and (not c.is_private
           or exists (select 1 from public.channel_members m where m.channel_id = c.id and m.user_id = auth.uid()))
  )
$$;

create or replace function public.is_channel_member(p_channel bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.channel_members m where m.channel_id = p_channel and m.user_id = auth.uid())
$$;

create or replace function public.is_channel_owner(p_channel bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.channels c where c.id = p_channel and c.created_by = auth.uid())
$$;

create or replace function public.are_contacts(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contacts
    where status = 'aceptado'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  )
$$;

-- Semáforo: combina horas de uso y lecturas de sensores.
create or replace function public.compute_level(p_since numeric, p_interval integer, p_temp numeric, p_vib numeric)
returns public.machine_level language sql immutable set search_path = '' as $$
  select greatest(
    case when p_since >= p_interval        then 'alta'::public.machine_level
         when p_since >= p_interval * 0.9  then 'recomendado'::public.machine_level
         when p_since >= p_interval * 0.7  then 'proximo'::public.machine_level
         else 'normal'::public.machine_level end,
    case when coalesce(p_temp,0) > 85 or coalesce(p_vib,0) > 6.5 then 'alta'::public.machine_level
         when coalesce(p_temp,0) > 75 or coalesce(p_vib,0) > 4.5 then 'recomendado'::public.machine_level
         else 'normal'::public.machine_level end)
$$;

-- Notificaciones (solo las llaman los triggers y funciones del servidor).
create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_area text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link, area)
  select p_user, p_kind, left(p_title,120), left(coalesce(p_body,''),300), p_link, p_area
  where p_user is not null
$$;

create or replace function public.notify_area(p_area text, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link, area)
  select p.id, p_kind, left(p_title,120), left(coalesce(p_body,''),300), p_link, p_area
  from public.profiles p
  where p.area = p_area or p.role in ('supervisor','admin')
$$;

create or replace function public.notify_staff(p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, p_kind, left(p_title,120), left(coalesce(p_body,''),300), p_link
  from public.profiles p where p.role in ('supervisor','admin')
$$;

-- ---------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------

-- 4.1 Crear el perfil cuando alguien se registra.
--     Todos empiezan como "tecnico". El PRIMER usuario queda como admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
  v_name     text := left(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), 80);
  v_area     text := coalesce(new.raw_user_meta_data->>'area', 'Producción');
  v_role     public.user_role := 'tecnico';
begin
  if v_username !~ '^[a-z0-9_.]{3,30}$' then
    v_username := 'usuario_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  if exists (select 1 from public.profiles where username = v_username) then
    v_username := left(v_username, 25) || '_' || substr(md5(random()::text), 1, 4);
  end if;
  if char_length(v_name) < 2 then v_name := v_username; end if;
  if v_area not in ('Producción','Mantenimiento','Calidad','Logística','Servicios') then
    v_area := 'Producción';
  end if;
  if not exists (select 1 from public.profiles where role = 'admin') then
    v_role := 'admin';
  end if;
  insert into public.profiles (id, username, full_name, area, role)
  values (new.id, v_username, v_name, v_area, v_role);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.2 Limpiar y validar el perfil antes de guardarlo.
create or replace function public.tg_profiles_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.full_name := btrim(new.full_name);
  new.headline  := btrim(new.headline);
  new.about     := btrim(new.about);
  select coalesce(array_agg(distinct btrim(s)), '{}') into new.skills
    from unnest(new.skills) s where btrim(s) <> '';
  if exists (select 1 from unnest(new.skills) s where char_length(s) > 40) then
    raise exception 'Cada habilidad puede tener máximo 40 caracteres' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists profiles_before on public.profiles;
create trigger profiles_before before insert or update on public.profiles
  for each row execute function public.tg_profiles_before();

-- 4.3 Máquinas: normalizar código y recalcular el semáforo siempre en el servidor.
create or replace function public.tg_machines_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.code  := upper(btrim(new.code));
  new.name  := btrim(new.name);
  new.model := btrim(new.model);
  new.level := public.compute_level(new.hours_since_service, new.interval_hours, new.last_temp, new.last_vib);
  return new;
end $$;
drop trigger if exists machines_before on public.machines;
create trigger machines_before before insert or update on public.machines
  for each row execute function public.tg_machines_before();

-- 4.4 Avisar al área cuando una máquina empeora a "recomendado" o "alta".
create or replace function public.tg_machines_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.machine_logs (machine_id, user_id, kind, note)
    values (new.id, auth.uid(), 'alta', 'Máquina registrada');
  elsif new.level > old.level and new.level >= 'recomendado' then
    perform public.notify_area(
      new.area, 'alerta',
      case when new.level = 'alta' then 'Prioridad alta: ' else 'Mantenimiento recomendado: ' end || new.name,
      format('%s (%s) cambió de estado. Revisa la ficha y crea una orden de trabajo.', new.name, new.code),
      '#/maquinas/' || new.id);
  end if;
  return null;
end $$;
drop trigger if exists machines_after on public.machines;
create trigger machines_after after insert or update on public.machines
  for each row execute function public.tg_machines_after();

-- 4.5 Cada lectura del sensor actualiza la máquina (y con ello su semáforo).
create or replace function public.tg_readings_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.machines
     set last_temp = new.temperature, last_vib = new.vibration, last_reading_at = new.recorded_at
   where id = new.machine_id
     and (last_reading_at is null or last_reading_at <= new.recorded_at);
  return null;
end $$;
drop trigger if exists readings_after on public.sensor_readings;
create trigger readings_after after insert on public.sensor_readings
  for each row execute function public.tg_readings_after();

-- 4.6 Fallas: avisar al área y dejar registro en la bitácora.
create or replace function public.tg_failures_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m public.machines;
begin
  select * into m from public.machines where id = new.machine_id;
  insert into public.machine_logs (machine_id, user_id, kind, value, note)
  values (new.machine_id, new.reported_by, 'falla', new.downtime_hours, left(new.cause, 300));
  perform public.notify_area(m.area, 'falla', 'Falla registrada: ' || m.name,
    format('%s · %s h de paro', new.cause, new.downtime_hours), '#/maquinas/' || m.id);
  return null;
end $$;
drop trigger if exists failures_after on public.failures;
create trigger failures_after after insert on public.failures
  for each row execute function public.tg_failures_after();

-- 4.7 Repuestos: avisar cuando el stock queda por debajo del mínimo.
create or replace function public.tg_parts_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stock < new.min_stock and (tg_op = 'INSERT' or old.stock >= old.min_stock) then
    perform public.notify_staff('stock', 'Stock bajo: ' || new.name,
      format('Quedan %s unidades (mínimo %s).', new.stock, new.min_stock), '#/repuestos');
  end if;
  return null;
end $$;
drop trigger if exists parts_after on public.parts;
create trigger parts_after after insert or update on public.parts
  for each row execute function public.tg_parts_after();

-- 4.8 Órdenes de trabajo: validar la lista de tareas y lo que puede cambiar un técnico.
create or replace function public.tg_orders_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.checklist) <> 'array' or jsonb_array_length(new.checklist) > 20 then
    raise exception 'La lista de tareas no es válida' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.checklist) e
    where jsonb_typeof(e) <> 'object'
       or jsonb_typeof(e->'text') <> 'string'
       or char_length(e->>'text') not between 1 and 120
       or jsonb_typeof(e->'done') <> 'boolean'
       or (select count(*) from jsonb_object_keys(e)) <> 2
  ) then
    raise exception 'Cada tarea debe tener texto (1 a 120 caracteres) y estado' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(new.safety_steps) s where char_length(s) not between 1 and 120) then
    raise exception 'Cada paso de seguridad debe tener entre 1 y 120 caracteres' using errcode = '22023';
  end if;
  if new.part_qty > 0 and new.part_id is null then
    raise exception 'Indica el repuesto si pones una cantidad' using errcode = '22023';
  end if;
  -- Un técnico (sin rol de supervisor) solo puede marcar tareas y escribir notas.
  if tg_op = 'UPDATE' and current_user = 'authenticated' and not public.is_staff() then
    if new.title is distinct from old.title or new.description is distinct from old.description
       or new.priority is distinct from old.priority or new.assignee is distinct from old.assignee
       or new.due_date is distinct from old.due_date or new.est_hours is distinct from old.est_hours
       or (select coalesce(jsonb_agg(e->'text'), '[]') from jsonb_array_elements(new.checklist) e)
          is distinct from
          (select coalesce(jsonb_agg(e->'text'), '[]') from jsonb_array_elements(old.checklist) e) then
      raise exception 'Como técnico solo puedes marcar tareas y escribir notas' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status = 'cerrada' and current_user = 'authenticated' then
    raise exception 'La orden ya está cerrada' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists orders_before on public.work_orders;
create trigger orders_before before insert or update on public.work_orders
  for each row execute function public.tg_orders_before();

create or replace function public.tg_orders_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m public.machines;
begin
  select * into m from public.machines where id = new.machine_id;
  if tg_op = 'INSERT' or new.assignee is distinct from old.assignee then
    if new.assignee is not null and new.assignee is distinct from auth.uid() then
      perform public.notify_user(new.assignee, 'orden', 'Nueva orden asignada: ' || new.title,
        format('%s · prioridad %s', m.name, new.priority), '#/ordenes/' || new.id, m.area);
    end if;
  end if;
  if tg_op = 'INSERT' then
    insert into public.machine_logs (machine_id, user_id, kind, note)
    values (new.machine_id, auth.uid(), 'orden', 'Orden creada: ' || left(new.title, 200));
  end if;
  return null;
end $$;
drop trigger if exists orders_after on public.work_orders;
create trigger orders_after after insert or update on public.work_orders
  for each row execute function public.tg_orders_after();

-- 4.9 Canales: quien crea un canal queda como miembro.
create or replace function public.tg_channels_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.channel_members (channel_id, user_id) values (new.id, new.created_by)
    on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists channels_after on public.channels;
create trigger channels_after after insert on public.channels
  for each row execute function public.tg_channels_after();

create or replace function public.tg_channels_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.name := btrim(new.name);
  new.description := btrim(new.description);
  return new;
end $$;
drop trigger if exists channels_before on public.channels;
create trigger channels_before before insert or update on public.channels
  for each row execute function public.tg_channels_before();

-- 4.10 Anti-spam: máximo 20 mensajes por minuto por persona.
create or replace function public.tg_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if tg_table_name = 'messages' then
    select count(*) into n from public.messages
     where author_id = new.author_id and created_at > now() - interval '1 minute';
  else
    select count(*) into n from public.direct_messages
     where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  end if;
  if n >= 20 then
    raise exception 'Estás enviando mensajes muy rápido. Espera un momento.' using errcode = 'P0001';
  end if;
  new.body := btrim(new.body);
  return new;
end $$;
drop trigger if exists messages_rate on public.messages;
create trigger messages_rate before insert on public.messages
  for each row execute function public.tg_rate_limit();
drop trigger if exists dm_rate on public.direct_messages;
create trigger dm_rate before insert on public.direct_messages
  for each row execute function public.tg_rate_limit();

-- 4.11 Contactos: evitar solicitudes duplicadas y avisar.
create or replace function public.tg_contacts_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.contacts where requester = new.addressee and addressee = new.requester) then
    raise exception 'Esa persona ya te envió una solicitud: acéptala en Equipo' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists contacts_before on public.contacts;
create trigger contacts_before before insert on public.contacts
  for each row execute function public.tg_contacts_before();

create or replace function public.tg_contacts_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if tg_op = 'INSERT' then
    select full_name into v_name from public.profiles where id = new.requester;
    perform public.notify_user(new.addressee, 'contacto', v_name || ' quiere agregarte',
      'Revisa tus solicitudes en Equipo.', '#/equipo');
  elsif new.status = 'aceptado' and old.status = 'pendiente' then
    select full_name into v_name from public.profiles where id = new.addressee;
    perform public.notify_user(new.requester, 'contacto', v_name || ' aceptó tu solicitud',
      'Ya pueden enviarse mensajes privados.', '#/mensajes/' || new.addressee);
  end if;
  return null;
end $$;
drop trigger if exists contacts_after on public.contacts;
create trigger contacts_after after insert or update on public.contacts
  for each row execute function public.tg_contacts_after();

-- ---------------------------------------------------------------------
-- 5. Funciones que llama la app (RPC). Todas validan quién llama.
-- ---------------------------------------------------------------------

-- Mi perfil completo (incluye el estado de los términos, que no es público).
create or replace function public.get_my_profile()
returns table (id uuid, username text, full_name text, headline text, about text, area text,
               role public.user_role, skills text[], avatar_path text, terms_version text,
               terms_accepted_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.full_name, p.headline, p.about, p.area, p.role, p.skills,
         p.avatar_path, p.terms_version, p.terms_accepted_at, p.created_at
  from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.accept_terms(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_version !~ '^v[0-9]+-[0-9]{4}-[0-9]{2}$' then raise exception 'Versión inválida' using errcode = '22023'; end if;
  update public.profiles set terms_version = p_version, terms_accepted_at = now() where id = auth.uid();
end $$;

create or replace function public.revoke_terms() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set terms_version = null, terms_accepted_at = null where id = auth.uid();
end $$;

-- Derecho de supresión (Ley 1581): borra la cuenta y todos sus datos personales.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if (select role from public.profiles where id = v_uid) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') = 1 then
    raise exception 'Eres el único administrador: asigna otro antes de borrar tu cuenta' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end $$;

-- Solo un administrador cambia roles. Nunca se queda la plataforma sin admin.
create or replace function public.set_user_role(p_user uuid, p_role public.user_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501';
  end if;
  if p_role <> 'admin' and (select role from public.profiles where id = p_user) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') = 1 then
    raise exception 'Debe quedar al menos un administrador' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'Usuario no encontrado' using errcode = 'P0002'; end if;
  perform public.notify_user(p_user, 'sistema', 'Tu rol cambió',
    'Ahora tu rol es ' || case p_role when 'tecnico' then 'Técnico' when 'supervisor' then 'Supervisor' else 'Administrador' end || '.',
    '#/perfil');
end $$;

-- Registrar horas de uso de una máquina (cualquier usuario, máximo 24 h por registro).
create or replace function public.add_machine_hours(p_machine bigint, p_hours numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_hours is null or p_hours < 0.1 or p_hours > 24 then
    raise exception 'Las horas deben estar entre 0,1 y 24' using errcode = '22023';
  end if;
  update public.machines
     set hours_total = hours_total + p_hours, hours_since_service = hours_since_service + p_hours
   where id = p_machine;
  if not found then raise exception 'Máquina no encontrada' using errcode = 'P0002'; end if;
  insert into public.machine_logs (machine_id, user_id, kind, value, note)
  values (p_machine, auth.uid(), 'horas', p_hours, 'Horas de uso registradas');
end $$;

-- Mantenimiento rápido (supervisor o admin): reinicia el contador de horas.
create or replace function public.register_maintenance(p_machine bigint, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Solo supervisores o administradores' using errcode = '42501';
  end if;
  if char_length(coalesce(p_note, '')) > 300 then raise exception 'Nota demasiado larga' using errcode = '22023'; end if;
  update public.machines set hours_since_service = 0, last_service_at = now() where id = p_machine;
  if not found then raise exception 'Máquina no encontrada' using errcode = 'P0002'; end if;
  insert into public.machine_logs (machine_id, user_id, kind, note)
  values (p_machine, auth.uid(), 'mantenimiento', coalesce(nullif(btrim(p_note), ''), 'Mantenimiento registrado'));
end $$;

-- Sensor IoT simulado: el SERVIDOR genera la lectura (el navegador no puede inventar valores).
create or replace function public.simulate_reading(p_machine bigint, p_anomaly boolean default false)
returns public.sensor_readings
language plpgsql security definer set search_path = '' as $$
declare
  m public.machines;
  r public.sensor_readings;
begin
  if auth.uid() is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_anomaly and not public.is_staff() then
    raise exception 'Solo supervisores o administradores pueden simular anomalías' using errcode = '42501';
  end if;
  select * into m from public.machines where id = p_machine;
  if not found then raise exception 'Máquina no encontrada' using errcode = 'P0002'; end if;
  -- Máximo una lectura cada 2 segundos por máquina.
  if not p_anomaly then
    select * into r from public.sensor_readings
     where machine_id = p_machine and recorded_at > now() - interval '2 seconds'
     order by recorded_at desc limit 1;
    if found then return r; end if;
  end if;
  insert into public.sensor_readings (machine_id, temperature, vibration, source)
  values (p_machine,
          round((m.temp_base + case when p_anomaly then 32 + random() * 6 else (random() - 0.5) * 6 end)::numeric, 1),
          round(greatest(0, m.vib_base + case when p_anomaly then 4.5 + random() * 1.5 else (random() - 0.5) * 0.8 end)::numeric, 2),
          'simulado')
  returning * into r;
  return r;
end $$;

create or replace function public.start_work_order(p_order bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.work_orders set status = 'en_progreso', started_at = now()
   where id = p_order and status = 'abierta'
     and (assignee = auth.uid() or public.is_staff());
  if not found then raise exception 'No puedes iniciar esta orden' using errcode = '42501'; end if;
end $$;

-- Cerrar una orden: descuenta el repuesto, reinicia las horas de la máquina y avisa.
create or replace function public.close_work_order(p_order bigint, p_real_hours numeric, p_notes text, p_cost numeric default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.work_orders;
begin
  select * into o from public.work_orders where id = p_order for update;
  if not found then raise exception 'Orden no encontrada' using errcode = 'P0002'; end if;
  if o.status = 'cerrada' then raise exception 'La orden ya está cerrada' using errcode = '42501'; end if;
  if not (o.assignee = auth.uid() or public.is_staff()) then
    raise exception 'Solo el responsable o un supervisor puede cerrar la orden' using errcode = '42501';
  end if;
  if p_real_hours is null or p_real_hours < 0 or p_real_hours > 500 then
    raise exception 'Tiempo real inválido (0 a 500 h)' using errcode = '22023';
  end if;
  if p_cost is null or p_cost < 0 or p_cost > 1000000000 then
    raise exception 'Costo inválido' using errcode = '22023';
  end if;
  if char_length(coalesce(p_notes, '')) > 1000 then raise exception 'Observaciones demasiado largas' using errcode = '22023'; end if;
  if o.part_id is not null and o.part_qty > 0 then
    update public.parts set stock = stock - o.part_qty where id = o.part_id and stock >= o.part_qty;
    if not found then raise exception 'No hay suficiente stock del repuesto' using errcode = 'P0001'; end if;
  end if;
  update public.work_orders
     set status = 'cerrada', closed_at = now(), started_at = coalesce(started_at, now()),
         real_hours = p_real_hours, notes = nullif(btrim(coalesce(p_notes, '')), ''), cost = p_cost
   where id = p_order;
  update public.machines set hours_since_service = 0, last_service_at = now() where id = o.machine_id;
  insert into public.machine_logs (machine_id, user_id, kind, value, note)
  values (o.machine_id, auth.uid(), 'mantenimiento', p_real_hours, 'Orden cerrada: ' || left(o.title, 200));
  if o.created_by is distinct from auth.uid() then
    perform public.notify_user(o.created_by, 'orden', 'Orden cerrada: ' || o.title,
      format('Tiempo real: %s h', p_real_hours), '#/ordenes/' || o.id);
  end if;
end $$;

-- Mis conversaciones privadas (último mensaje y no leídos). Respeta RLS.
create or replace function public.my_conversations()
returns table (other_id uuid, last_body text, last_at timestamptz, last_from_me boolean, unread integer)
language sql stable set search_path = '' as $$
  with mine as (
    select case when d.sender_id = auth.uid() then d.recipient_id else d.sender_id end as other_id,
           d.body, d.created_at, d.sender_id = auth.uid() as from_me,
           (d.recipient_id = auth.uid() and d.read_at is null) as is_unread
    from public.direct_messages d
    where auth.uid() in (d.sender_id, d.recipient_id)
  ), counts as (
    select other_id, count(*) filter (where is_unread)::integer as unread from mine group by other_id
  )
  select distinct on (m.other_id) m.other_id, left(m.body, 120), m.created_at, m.from_me, c.unread
  from mine m join counts c using (other_id)
  order by m.other_id, m.created_at desc
$$;

create or replace function public.mark_conversation_read(p_other uuid) returns void
language sql security definer set search_path = '' as $$
  update public.direct_messages set read_at = now()
   where recipient_id = auth.uid() and sender_id = p_other and read_at is null
$$;

-- ---------------------------------------------------------------------
-- 6. Row Level Security: políticas por tabla
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.machines        enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.machine_logs    enable row level security;
alter table public.failures        enable row level security;
alter table public.parts           enable row level security;
alter table public.work_orders     enable row level security;
alter table public.channels        enable row level security;
alter table public.channel_members enable row level security;
alter table public.messages        enable row level security;
alter table public.contacts        enable row level security;
alter table public.direct_messages enable row level security;
alter table public.notifications   enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Perfiles: todos los usuarios con sesión los ven; cada uno edita solo el suyo.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Máquinas: todos ven; supervisor/admin crean y editan; solo admin borra.
create policy machines_select on public.machines for select to authenticated using (true);
create policy machines_insert on public.machines for insert to authenticated with check (public.is_staff());
create policy machines_update on public.machines for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy machines_delete on public.machines for delete to authenticated using (public.is_admin());

create policy readings_select on public.sensor_readings for select to authenticated using (true);
create policy logs_select     on public.machine_logs    for select to authenticated using (true);

-- Fallas: cualquiera reporta (queda a su nombre); solo admin borra.
create policy failures_select on public.failures for select to authenticated using (true);
create policy failures_insert on public.failures for insert to authenticated
  with check (reported_by = (select auth.uid()));
create policy failures_delete on public.failures for delete to authenticated using (public.is_admin());

-- Repuestos
create policy parts_select on public.parts for select to authenticated using (true);
create policy parts_insert on public.parts for insert to authenticated with check (public.is_staff());
create policy parts_update on public.parts for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy parts_delete on public.parts for delete to authenticated using (public.is_admin());

-- Órdenes: todos ven; supervisor/admin crean; el responsable o un supervisor editan.
create policy orders_select on public.work_orders for select to authenticated using (true);
create policy orders_insert on public.work_orders for insert to authenticated
  with check (public.is_staff() and created_by = (select auth.uid()));
create policy orders_update on public.work_orders for update to authenticated
  using (assignee = (select auth.uid()) or public.is_staff())
  with check (assignee = (select auth.uid()) or public.is_staff());
create policy orders_delete on public.work_orders for delete to authenticated using (public.is_admin());

-- Canales: los públicos los ven todos; los privados solo sus miembros.
create policy channels_select on public.channels for select to authenticated
  using (not is_private or created_by = (select auth.uid()) or public.is_channel_member(id));
create policy channels_insert on public.channels for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy channels_update on public.channels for update to authenticated
  using (created_by = (select auth.uid()) or public.is_admin())
  with check (created_by = (select auth.uid()) or public.is_admin());
create policy channels_delete on public.channels for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_admin());

create policy members_select on public.channel_members for select to authenticated
  using (public.can_access_channel(channel_id));
create policy members_insert on public.channel_members for insert to authenticated
  with check (public.is_channel_owner(channel_id) or public.is_admin());
create policy members_delete on public.channel_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_channel_owner(channel_id) or public.is_admin());

create policy messages_select on public.messages for select to authenticated
  using (public.can_access_channel(channel_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_access_channel(channel_id));
create policy messages_delete on public.messages for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- Contactos: solo las dos personas involucradas.
create policy contacts_select on public.contacts for select to authenticated
  using ((select auth.uid()) in (requester, addressee));
create policy contacts_insert on public.contacts for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pendiente');
create policy contacts_update on public.contacts for update to authenticated
  using (addressee = (select auth.uid())) with check (addressee = (select auth.uid()) and status = 'aceptado');
create policy contacts_delete on public.contacts for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- Mensajes privados: solo emisor y receptor; solo entre contactos aceptados.
create policy dm_select on public.direct_messages for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));
create policy dm_insert on public.direct_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.are_contacts(sender_id, recipient_id));

-- Notificaciones: cada quien las suyas.
create policy notif_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 7. Permisos por tabla y por columna ("bloquear la manipulación de campos")
--    Supabase da todo a anon/authenticated por defecto: lo quitamos y
--    damos solo lo necesario.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;  -- necesario para la API de datos
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select (id, username, full_name, headline, about, area, role, skills, avatar_path, created_at)
  on public.profiles to authenticated;
grant update (full_name, headline, about, area, skills, avatar_path) on public.profiles to authenticated;

grant select on public.machines to authenticated;
grant insert (code, name, model, stage, area, hours_total, interval_hours, hours_since_service, temp_base, vib_base)
  on public.machines to authenticated;
grant update (name, model, stage, area, interval_hours, temp_base, vib_base) on public.machines to authenticated;
grant delete on public.machines to authenticated;

grant select on public.sensor_readings, public.machine_logs to authenticated;

grant select, delete on public.failures to authenticated;
grant insert (machine_id, cause, downtime_hours, cost, occurred_at) on public.failures to authenticated;

grant select, delete on public.parts to authenticated;
grant insert (sku, name, stock, min_stock, unit_cost) on public.parts to authenticated;
grant update (name, stock, min_stock, unit_cost) on public.parts to authenticated;

grant select, delete on public.work_orders to authenticated;
grant insert (machine_id, title, description, kind, priority, assignee, due_date, est_hours, safety_steps, checklist, part_id, part_qty)
  on public.work_orders to authenticated;
grant update (title, description, priority, assignee, due_date, est_hours, checklist, notes) on public.work_orders to authenticated;

grant select, delete on public.channels to authenticated;
grant insert (name, area, description, is_private) on public.channels to authenticated;
grant update (name, description) on public.channels to authenticated;

grant select, delete on public.channel_members to authenticated;
grant insert (channel_id, user_id) on public.channel_members to authenticated;

grant select, delete on public.messages to authenticated;
grant insert (channel_id, body) on public.messages to authenticated;

grant select, delete on public.contacts to authenticated;
grant insert (addressee) on public.contacts to authenticated;
grant update (status) on public.contacts to authenticated;

grant select on public.direct_messages to authenticated;
grant insert (recipient_id, body) on public.direct_messages to authenticated;

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Funciones: nadie las ejecuta salvo las que la app necesita.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.my_role(), public.is_staff(), public.is_admin(),
  public.can_access_channel(bigint), public.is_channel_member(bigint), public.is_channel_owner(bigint), public.are_contacts(uuid, uuid),
  public.compute_level(numeric, integer, numeric, numeric),
  public.get_my_profile(), public.accept_terms(text), public.revoke_terms(), public.delete_my_account(),
  public.set_user_role(uuid, public.user_role), public.add_machine_hours(bigint, numeric),
  public.register_maintenance(bigint, text), public.simulate_reading(bigint, boolean),
  public.start_work_order(bigint), public.close_work_order(bigint, numeric, text, numeric),
  public.my_conversations(), public.mark_conversation_read(uuid)
to authenticated;

-- Que las funciones nuevas no queden abiertas por defecto.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Fotos de perfil (Storage): carpeta privada por usuario, solo WEBP, máx 2 MB
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "maqnex avatars read"   on storage.objects;
drop policy if exists "maqnex avatars insert" on storage.objects;
drop policy if exists "maqnex avatars update" on storage.objects;
drop policy if exists "maqnex avatars delete" on storage.objects;

create policy "maqnex avatars read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "maqnex avatars insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and lower(storage.extension(name)) = 'webp');
create policy "maqnex avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "maqnex avatars delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 9. Tiempo real (chat, notificaciones, sensores). Respeta RLS.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages','direct_messages','notifications','machines','sensor_readings','work_orders','contacts'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 10. Datos iniciales de la planta (solo si las tablas están vacías)
-- ---------------------------------------------------------------------
insert into public.channels (name, area, description, created_by)
select v.name, v.area, v.description, null
from (values
  ('General', null::text, 'Avisos para toda la planta'),
  ('Producción', 'Producción', 'Coordinación de la línea de embotellado'),
  ('Mantenimiento', 'Mantenimiento', 'Fallas, órdenes y repuestos'),
  ('Calidad', 'Calidad', 'Controles de calidad e higiene'),
  ('Logística', 'Logística', 'Materias primas y despachos')
) as v(name, area, description)
where not exists (select 1 from public.channels);

insert into public.machines (code, name, model, stage, area, hours_total, interval_hours, hours_since_service, temp_base, vib_base, created_by)
select v.code, v.name, v.model, v.stage, v.area, v.ht, v.ih, v.hs, v.tb, v.vb, null
from (values
  ('MZ-01', 'Mezcladora de jarabe', 'Tanque agitador 2.000 L', 'preparacion', 'Producción', 6420.0, 500, 380.0, 48.0, 2.1),
  ('LL-01', 'Llenadora rotativa',   'Rotativa 24 válvulas',    'llenado',     'Producción', 8130.0, 400, 150.0, 52.0, 2.8),
  ('CP-01', 'Compresor de aire',    'Tornillo 30 HP',          'servicios',   'Servicios',  11250.0, 1000, 930.0, 64.0, 3.2)
) as v(code, name, model, stage, area, ht, ih, hs, tb, vb)
where not exists (select 1 from public.machines);

insert into public.parts (sku, name, stock, min_stock, unit_cost)
select v.sku, v.name, v.stock, v.min_stock, v.unit_cost
from (values
  ('ROD-6205', 'Rodamiento 6205', 8, 4, 38000),
  ('SEL-MEC',  'Sello mecánico de válvula', 3, 4, 125000),
  ('FIL-AIR',  'Filtro de aire del compresor', 5, 2, 92000),
  ('COR-B54',  'Correa en V B-54', 6, 3, 41000)
) as v(sku, name, stock, min_stock, unit_cost)
where not exists (select 1 from public.parts);

-- Listo. Siguiente paso: Authentication → Sign Up, y crea tu cuenta desde la app.
-- La primera cuenta que se registre queda como Administrador.
