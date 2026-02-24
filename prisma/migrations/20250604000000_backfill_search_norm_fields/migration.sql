-- Backfill displayNameNorm and usernameNorm for any rows where they
-- are empty (accounts created before the norm columns were populated).
UPDATE "SearchableUser"
SET
  "displayNameNorm" = LOWER(TRIM("displayName")),
  "usernameNorm"    = LOWER(TRIM("username"))
WHERE
  "displayNameNorm" = ''
  OR "usernameNorm"  = '';
