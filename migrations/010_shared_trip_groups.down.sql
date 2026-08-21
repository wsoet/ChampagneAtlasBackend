BEGIN;
DROP TRIGGER IF EXISTS trip_groups_seed_owner ON trip_groups;
DROP FUNCTION IF EXISTS seed_trip_group_owner_membership();
DROP TABLE IF EXISTS trip_group_audit;
DROP TABLE IF EXISTS trip_group_invitations;
DROP TABLE IF EXISTS trip_group_members;
DROP TABLE IF EXISTS trip_groups;
COMMIT;
