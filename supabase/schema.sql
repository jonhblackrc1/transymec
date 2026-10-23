-- =====================================================================
--  TRANSYMEC · CRM de viajes — esquema para Supabase
-- ---------------------------------------------------------------------
--  Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este
--  archivo → Run. Se puede volver a ejecutar sin perder datos.
--
--  Roles:
--   · admin      → todo el CRM
--   · conductor  → solo los viajes que tiene asignados
--   · pasajero   → sin cuenta; entra al portal con código + clave
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
--  Tablas
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  usuario        text unique,
  nombre         text not null default '',
  rol            text not null default 'conductor' check (rol in ('admin','conductor')),
  telefono       text,
  licencia_clase text,
  licencia_vence date,
  activo         boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Usuarios que el admin pre-autoriza antes de crear su cuenta.
create table if not exists public.invitaciones (
  email          text primary key,
  rol            text not null check (rol in ('admin','conductor')),
  nombre         text not null,
  telefono       text,
  licencia_clase text,
  licencia_vence date,
  created_at     timestamptz not null default now()
);

create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  empresa    text,
  rut        text,
  telefono   text,
  email      text,
  notas      text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehiculos (
  id                     uuid primary key default gen_random_uuid(),
  patente                text not null unique,
  tipo                   text not null default 'Bus',
  marca_modelo           text,
  capacidad              int  not null default 45 check (capacidad > 0),
  estado                 text not null default 'disponible'
                         check (estado in ('disponible','mantencion','fuera_servicio')),
  revision_tecnica_vence date,
  seguro_vence           date,
  notas                  text,
  created_at             timestamptz not null default now()
);

create table if not exists public.viajes (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique,
  cliente_id          uuid references public.clientes(id) on delete set null,
  servicio            text not null default 'Viaje especial',
  origen              text not null,
  destino             text not null,
  punto_encuentro     text,
  paradas             text,
  salida              timestamptz not null,
  regreso             timestamptz,
  pasajeros_estimados int,
  vehiculo_id         uuid references public.vehiculos(id) on delete set null,
  conductor_id        uuid references public.profiles(id) on delete set null,
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente','confirmado','en_curso','finalizado','cancelado')),
  instrucciones       text,   -- visibles para el pasajero
  notas_internas      text,   -- solo admin y conductor
  ultima_lat          double precision,
  ultima_lng          double precision,
  ultima_ubicacion_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists viajes_salida_idx    on public.viajes (salida);
create index if not exists viajes_conductor_idx on public.viajes (conductor_id);

-- Clave del portal del pasajero (solo el hash, nunca la clave).
create table if not exists public.viaje_accesos (
  viaje_id   uuid primary key references public.viajes(id) on delete cascade,
  clave_hash text not null,
  updated_at timestamptz not null default now()
);

-- Nómina de pasajeros.
create table if not exists public.pasajeros (
  id         uuid primary key default gen_random_uuid(),
  viaje_id   uuid not null references public.viajes(id) on delete cascade,
  nombre     text not null,
  documento  text,
  telefono   text,
  abordo     boolean not null default false,
  origen     text not null default 'admin' check (origen in ('admin','portal')),
  created_at timestamptz not null default now()
);
create index if not exists pasajeros_viaje_idx on public.pasajeros (viaje_id);

-- Bitácora del viaje (las públicas las ve el pasajero).
create table if not exists public.viaje_eventos (
  id           uuid primary key default gen_random_uuid(),
  viaje_id     uuid not null references public.viajes(id) on delete cascade,
  tipo         text not null default 'nota',
  mensaje      text not null,
  publico      boolean not null default false,
  lat          double precision,
  lng          double precision,
  autor_id     uuid references public.profiles(id) on delete set null,
  autor_nombre text,
  created_at   timestamptz not null default now()
);
create index if not exists eventos_viaje_idx on public.viaje_eventos (viaje_id, created_at);

-- Intentos fallidos del portal (protección contra adivinar claves).
create table if not exists public.portal_intentos (
  id         bigserial primary key,
  codigo     text not null,
  created_at timestamptz not null default now()
);
create index if not exists portal_intentos_idx on public.portal_intentos (codigo, created_at);

-- ---------------------------------------------------------------------
--  Funciones auxiliares de permisos
-- ---------------------------------------------------------------------
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and rol = 'admin' and activo);
$$;

create or replace function public.es_conductor_de(p_viaje uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from viajes v join profiles p on p.id = v.conductor_id
    where v.id = p_viaje and v.conductor_id = auth.uid() and p.activo
  );
$$;

create or replace function public.tg_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists viajes_updated_at on public.viajes;
create trigger viajes_updated_at before update on public.viajes
for each row execute function public.tg_updated_at();

-- Al crearse una cuenta: si estaba invitada, se activa con su rol.
-- Si no (alguien se registró por su cuenta), queda inactiva sin acceso.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv invitaciones;
begin
  select * into inv from invitaciones where lower(email) = lower(new.email);
  if found then
    insert into profiles (id, usuario, nombre, rol, telefono, licencia_clase, licencia_vence, activo)
    values (new.id, split_part(new.email, '@', 1), inv.nombre, inv.rol, inv.telefono,
            inv.licencia_clase, inv.licencia_vence, true)
    on conflict (id) do nothing;
    delete from invitaciones where email = inv.email;
  else
    insert into profiles (id, usuario, nombre, rol, activo)
    values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1), 'conductor', false)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
--  Seguridad por filas (RLS)
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.invitaciones    enable row level security;
alter table public.clientes        enable row level security;
alter table public.vehiculos       enable row level security;
alter table public.viajes          enable row level security;
alter table public.viaje_accesos   enable row level security;
alter table public.pasajeros       enable row level security;
alter table public.viaje_eventos   enable row level security;
alter table public.portal_intentos enable row level security;

do $$
declare t text;
begin
  -- El admin puede todo en estas tablas.
  foreach t in array array['profiles','invitaciones','clientes','vehiculos','viajes',
                           'viaje_accesos','pasajeros','viaje_eventos'] loop
    execute format('drop policy if exists admin_todo on public.%I', t);
    execute format('create policy admin_todo on public.%I for all
                    using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;

-- Cada usuario ve su propio perfil (no puede editarlo: no sube su rol).
drop policy if exists perfil_propio on public.profiles;
create policy perfil_propio on public.profiles for select using (id = auth.uid());

-- El conductor ve solo sus viajes y lo relacionado con ellos.
drop policy if exists conductor_viajes on public.viajes;
create policy conductor_viajes on public.viajes for select
  using (public.es_conductor_de(id));

drop policy if exists conductor_clientes on public.clientes;
create policy conductor_clientes on public.clientes for select
  using (exists (select 1 from public.viajes v where v.cliente_id = clientes.id and public.es_conductor_de(v.id)));

drop policy if exists conductor_vehiculos on public.vehiculos;
create policy conductor_vehiculos on public.vehiculos for select
  using (exists (select 1 from public.viajes v where v.vehiculo_id = vehiculos.id and public.es_conductor_de(v.id)));

drop policy if exists conductor_pasajeros on public.pasajeros;
create policy conductor_pasajeros on public.pasajeros for select
  using (public.es_conductor_de(viaje_id));

drop policy if exists conductor_eventos on public.viaje_eventos;
create policy conductor_eventos on public.viaje_eventos for select
  using (public.es_conductor_de(viaje_id));

-- ---------------------------------------------------------------------
--  Acciones del conductor / admin (validadas en el servidor)
-- ---------------------------------------------------------------------

-- Registra un evento en la bitácora (y la ubicación, si viene).
create or replace function public.registrar_evento(
  p_viaje uuid, p_tipo text, p_mensaje text, p_publico boolean default true,
  p_lat double precision default null, p_lng double precision default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_nombre text;
begin
  if not (es_admin() or es_conductor_de(p_viaje)) then
    raise exception 'No tienes permiso sobre este viaje';
  end if;
  if coalesce(trim(p_mensaje), '') = '' then raise exception 'El mensaje está vacío'; end if;
  select nombre into v_nombre from profiles where id = auth.uid();
  insert into viaje_eventos (viaje_id, tipo, mensaje, publico, lat, lng, autor_id, autor_nombre)
  values (p_viaje, coalesce(p_tipo, 'nota'), left(trim(p_mensaje), 500), p_publico,
          p_lat, p_lng, auth.uid(), v_nombre);
  if p_lat is not null and p_lng is not null then
    update viajes set ultima_lat = p_lat, ultima_lng = p_lng, ultima_ubicacion_at = now()
    where id = p_viaje;
  end if;
end $$;

-- Iniciar / finalizar viaje.
create or replace function public.cambiar_estado_viaje(
  p_viaje uuid, p_estado text, p_nota text default null,
  p_lat double precision default null, p_lng double precision default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v viajes; v_msg text;
begin
  select * into v from viajes where id = p_viaje;
  if not found then raise exception 'Viaje no encontrado'; end if;
  if not (es_admin() or es_conductor_de(p_viaje)) then
    raise exception 'No tienes permiso sobre este viaje';
  end if;
  if not ((v.estado = 'confirmado' and p_estado = 'en_curso')
       or (v.estado = 'en_curso'   and p_estado = 'finalizado')) then
    raise exception 'No se puede pasar de % a %', v.estado, p_estado;
  end if;
  update viajes set estado = p_estado where id = p_viaje;
  v_msg := case p_estado when 'en_curso' then 'Viaje iniciado' else 'Viaje finalizado' end
           || coalesce(' · ' || nullif(trim(p_nota), ''), '');
  perform registrar_evento(p_viaje, 'estado', v_msg, true, p_lat, p_lng);
end $$;

-- Marcar abordaje de un pasajero.
create or replace function public.marcar_abordo(p_pasajero uuid, p_abordo boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_viaje uuid;
begin
  select viaje_id into v_viaje from pasajeros where id = p_pasajero;
  if v_viaje is null then raise exception 'Pasajero no encontrado'; end if;
  if not (es_admin() or es_conductor_de(v_viaje)) then
    raise exception 'No tienes permiso sobre este viaje';
  end if;
  update pasajeros set abordo = p_abordo where id = p_pasajero;
end $$;

-- El admin define la clave del portal (se guarda solo el hash).
create or replace function public.admin_set_clave(p_viaje uuid, p_clave text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not es_admin() then raise exception 'Solo el administrador puede hacer esto'; end if;
  if length(coalesce(p_clave, '')) < 6 then raise exception 'La clave debe tener al menos 6 caracteres'; end if;
  insert into viaje_accesos (viaje_id, clave_hash, updated_at)
  values (p_viaje, crypt(upper(trim(p_clave)), gen_salt('bf')), now())
  on conflict (viaje_id) do update set clave_hash = excluded.clave_hash, updated_at = now();
end $$;

-- ---------------------------------------------------------------------
--  Portal del pasajero (sin cuenta: código + clave)
-- ---------------------------------------------------------------------
create or replace function public._portal_validar(p_codigo text, p_clave text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_hash text; v_fallos int; v_cod text := upper(trim(coalesce(p_codigo, '')));
begin
  select count(*) into v_fallos from portal_intentos
  where codigo = v_cod and created_at > now() - interval '15 minutes';
  if v_fallos >= 8 then
    return jsonb_build_object('error', 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.');
  end if;
  select v.id, a.clave_hash into v_id, v_hash
  from viajes v join viaje_accesos a on a.viaje_id = v.id
  where v.codigo = v_cod;
  if v_id is null or crypt(upper(trim(coalesce(p_clave, ''))), v_hash) <> v_hash then
    insert into portal_intentos (codigo) values (v_cod);
    return jsonb_build_object('error', 'El código o la clave no son correctos.');
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.portal_ver(p_codigo text, p_clave text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare chk jsonb; v_id uuid; r jsonb;
begin
  chk := _portal_validar(p_codigo, p_clave);
  if chk ? 'error' then return chk; end if;
  v_id := (chk ->> 'id')::uuid;
  select jsonb_build_object(
    'viaje', jsonb_build_object(
      'codigo', v.codigo, 'servicio', v.servicio, 'origen', v.origen, 'destino', v.destino,
      'punto_encuentro', v.punto_encuentro, 'paradas', v.paradas, 'salida', v.salida,
      'regreso', v.regreso, 'pasajeros_estimados', v.pasajeros_estimados, 'estado', v.estado,
      'instrucciones', v.instrucciones,
      'ultima_lat', case when v.estado = 'en_curso' then v.ultima_lat end,
      'ultima_lng', case when v.estado = 'en_curso' then v.ultima_lng end,
      'ultima_ubicacion_at', case when v.estado = 'en_curso' then v.ultima_ubicacion_at end),
    'cliente',   (select jsonb_build_object('nombre', c.nombre, 'empresa', c.empresa)
                  from clientes c where c.id = v.cliente_id),
    'conductor', (select jsonb_build_object('nombre', p.nombre, 'telefono', p.telefono)
                  from profiles p where p.id = v.conductor_id),
    'vehiculo',  (select jsonb_build_object('tipo', x.tipo, 'marca_modelo', x.marca_modelo,
                         'patente', x.patente, 'capacidad', x.capacidad)
                  from vehiculos x where x.id = v.vehiculo_id),
    'eventos',   coalesce((select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'mensaje', e.mensaje,
                         'created_at', e.created_at, 'lat', e.lat, 'lng', e.lng) order by e.created_at desc)
                  from viaje_eventos e where e.viaje_id = v.id and e.publico), '[]'::jsonb),
    'pasajeros', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre,
                         'abordo', p.abordo, 'origen', p.origen) order by p.created_at)
                  from pasajeros p where p.viaje_id = v.id), '[]'::jsonb)
  ) into r
  from viajes v where v.id = v_id;
  return r;
end $$;

create or replace function public.portal_agregar_pasajero(
  p_codigo text, p_clave text, p_nombre text, p_documento text default null, p_telefono text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare chk jsonb; v viajes; v_total int;
begin
  chk := _portal_validar(p_codigo, p_clave);
  if chk ? 'error' then return chk; end if;
  select * into v from viajes where id = (chk ->> 'id')::uuid;
  if v.estado not in ('pendiente', 'confirmado') then
    return jsonb_build_object('error', 'La nómina ya no se puede modificar porque el viaje comenzó o terminó.');
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    return jsonb_build_object('error', 'Escribe el nombre del pasajero.');
  end if;
  select count(*) into v_total from pasajeros where viaje_id = v.id;
  if v_total >= 120 then return jsonb_build_object('error', 'La nómina está completa.'); end if;
  insert into pasajeros (viaje_id, nombre, documento, telefono, origen)
  values (v.id, left(trim(p_nombre), 120), left(trim(p_documento), 30), left(trim(p_telefono), 30), 'portal');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.portal_quitar_pasajero(p_codigo text, p_clave text, p_pasajero uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare chk jsonb; v viajes;
begin
  chk := _portal_validar(p_codigo, p_clave);
  if chk ? 'error' then return chk; end if;
  select * into v from viajes where id = (chk ->> 'id')::uuid;
  if v.estado not in ('pendiente', 'confirmado') then
    return jsonb_build_object('error', 'La nómina ya no se puede modificar.');
  end if;
  delete from pasajeros where id = p_pasajero and viaje_id = v.id and origen = 'portal';
  return jsonb_build_object('ok', true);
end $$;

-- Permisos de ejecución.
revoke all on function public._portal_validar(text, text) from public, anon, authenticated;
revoke all on function public.admin_set_clave(uuid, text) from public, anon;
revoke all on function public.registrar_evento(uuid, text, text, boolean, double precision, double precision) from public, anon;
revoke all on function public.cambiar_estado_viaje(uuid, text, text, double precision, double precision) from public, anon;
revoke all on function public.marcar_abordo(uuid, boolean) from public, anon;
grant execute on function public.admin_set_clave(uuid, text) to authenticated;
grant execute on function public.registrar_evento(uuid, text, text, boolean, double precision, double precision) to authenticated;
grant execute on function public.cambiar_estado_viaje(uuid, text, text, double precision, double precision) to authenticated;
grant execute on function public.marcar_abordo(uuid, boolean) to authenticated;
grant execute on function public.portal_ver(text, text) to anon, authenticated;
grant execute on function public.portal_agregar_pasajero(text, text, text, text, text) to anon, authenticated;
grant execute on function public.portal_quitar_pasajero(text, text, uuid) to anon, authenticated;

-- =====================================================================
--  PRIMER ADMINISTRADOR
--  1) Crea el usuario en Authentication → Users → Add user
--     (email: root@transymec.cl, con "Auto Confirm User" marcado).
--  2) Ejecuta esta sentencia (cambia el email si usaste otro):
-- =====================================================================
insert into public.profiles (id, usuario, nombre, rol, activo)
select id, split_part(email, '@', 1), 'Administrador', 'admin', true
from auth.users where email = 'root@transymec.cl'
on conflict (id) do update set rol = 'admin', activo = true;
