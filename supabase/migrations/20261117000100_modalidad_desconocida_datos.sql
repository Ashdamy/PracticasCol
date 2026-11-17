-- Corrección de datos (aprobada por el PO): las convocatorias a las que la ingesta les ASUMIÓ
-- «presencial» porque la fuente no decía la modalidad pasan a `no_especificada`, y se les quita
-- esa observación («Modalidad: Modalidad no indicada: se asumió presencial»).
-- No cambia `status` ni `needs_review`: lo que está en revisión sigue en revisión, con las notas limpias.
-- Es idempotente: una segunda corrida no encuentra filas.
update opportunities
set modality = 'no_especificada',
    review_notes = array(
      select n
      from unnest(review_notes) with ordinality as t(n, i)
      where n not ilike '%Modalidad no indicada%'
      order by i
    )
where exists (select 1 from unnest(review_notes) as n where n ilike '%Modalidad no indicada%');
