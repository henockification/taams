-- Temporary department assignments may have no known end date. A NULL effective_to is
-- open-ended: the existing date-range CHECK passes for NULL, and the no-overlap exclusion
-- constraint treats a NULL daterange upper bound as unbounded.
ALTER TABLE "temporary_department_assignments" ALTER COLUMN "effective_to" DROP NOT NULL;
