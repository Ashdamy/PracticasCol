-- Contrato v0.1.2: modalidad «desconocida» (`no_especificada`).
-- Va sola en esta migración: en Postgres un valor nuevo de enum no se puede usar en la misma
-- transacción en la que se agrega. La corrección de datos está en la migración siguiente.
alter type modality add value if not exists 'no_especificada';
