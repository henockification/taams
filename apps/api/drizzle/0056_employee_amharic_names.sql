-- Fill the Amharic name columns from the Amharic full name kept in the ISMIS import row
-- ("Full Name"), split like the English name: given, father's (middle) and grandfather's.
-- Only employees with no Amharic name on file are touched, and only when the source name
-- is in Ethiopic script, so names typed in by HR are never overwritten. Safe to re-run.
WITH source AS (
  SELECT
    "id",
    regexp_split_to_array(btrim(regexp_replace("source_raw_payload"->>'Full Name', '[[:space:]]+', ' ', 'g')), ' ') AS parts
  FROM "employees"
  WHERE coalesce(btrim("first_name_am"), '') = ''
    AND coalesce(btrim("middle_name_am"), '') = ''
    AND coalesce(btrim("last_name_am"), '') = ''
    AND "source_raw_payload"->>'Full Name' ~ '[ሀ-፿]'
)
UPDATE "employees" AS e
SET
  "first_name_am" = left(source.parts[1], 100),
  "middle_name_am" = CASE
    WHEN cardinality(source.parts) >= 3 THEN left(array_to_string(source.parts[2:cardinality(source.parts) - 1], ' '), 100)
  END,
  "last_name_am" = left(source.parts[cardinality(source.parts)], 100)
FROM source
WHERE e."id" = source."id";
