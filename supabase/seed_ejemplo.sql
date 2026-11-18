-- =====================================================================
--  MAQNEX · Historial de ejemplo (OPCIONAL)
--  Ejecútalo DESPUÉS de schema.sql si quieres que las gráficas y los
--  indicadores tengan datos desde el primer día (útil para la exposición).
--  Todo lo que agrega está marcado como "(histórico de ejemplo)".
--  Para borrarlo después:
--    delete from public.failures where cause like '%(histórico de ejemplo)';
--    delete from public.sensor_readings where source = 'simulado' and recorded_at < now() - interval '1 hour';
-- =====================================================================

-- Fallas de los últimos 90 días
insert into public.failures (machine_id, cause, downtime_hours, cost, occurred_at, reported_by)
select m.id, v.cause || ' (histórico de ejemplo)', v.downtime, v.cost, now() - (v.days || ' days')::interval, null
from (values
  ('MZ-01', 'Desgaste del sello del agitador', 6.0, 420000, 78),
  ('LL-01', 'Válvula de llenado obstruida',    3.5, 180000, 64),
  ('LL-01', 'Válvula de llenado obstruida',    4.0, 210000, 31),
  ('CP-01', 'Sobrecalentamiento del motor',    8.0, 950000, 47),
  ('CP-01', 'Filtro de aire saturado',         2.0, 120000, 12),
  ('MZ-01', 'Correa del motor destensada',     1.5,  60000, 9)
) as v(code, cause, downtime, cost, days)
join public.machines m on m.code = v.code;

-- Lecturas de sensores de las últimas 48 horas (una cada hora por máquina)
insert into public.sensor_readings (machine_id, temperature, vibration, source, recorded_at)
select m.id,
       round((m.temp_base + sin(h / 4.0) * 3 + (random() - 0.5) * 2)::numeric, 1),
       round(greatest(0, m.vib_base + cos(h / 5.0) * 0.3 + (random() - 0.5) * 0.3)::numeric, 2),
       'simulado',
       now() - (h || ' hours')::interval
from public.machines m
cross join generate_series(1, 48) as h
where m.code in ('MZ-01', 'LL-01', 'CP-01');
