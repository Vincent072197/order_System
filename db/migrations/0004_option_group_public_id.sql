-- Slice C3 prerequisite: give menu_option_groups a public UUID so option
-- groups can be addressed through the staff admin API/URLs without ever
-- exposing the BIGINT id (CLAUDE.md §3 rule 2). Categories use slug and
-- everything else already had a public_id; option groups were the gap.
--
-- Backfill-safe: add nullable, fill existing rows, then enforce NOT NULL +
-- UNIQUE and set the default for future inserts.

ALTER TABLE menu_option_groups ADD COLUMN public_id UUID;

UPDATE menu_option_groups SET public_id = gen_random_uuid() WHERE public_id IS NULL;

ALTER TABLE menu_option_groups ALTER COLUMN public_id SET DEFAULT gen_random_uuid();
ALTER TABLE menu_option_groups ALTER COLUMN public_id SET NOT NULL;

ALTER TABLE menu_option_groups
  ADD CONSTRAINT menu_option_groups_public_id_key UNIQUE (public_id);
