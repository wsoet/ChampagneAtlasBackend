BEGIN;
DELETE FROM chef_action_drafts WHERE type='SAVE_TASTE_PREFERENCE';
ALTER TABLE chef_action_drafts DROP CONSTRAINT IF EXISTS chef_action_drafts_type_check;
ALTER TABLE chef_action_drafts ADD CONSTRAINT chef_action_drafts_type_check CHECK(type IN('CREATE_TRIP','ADD_FAVORITE'));
DROP TABLE IF EXISTS user_taste_evidence;
DROP TABLE IF EXISTS chef_recommendation_feedback;
DROP TABLE IF EXISTS chef_recommendations;
COMMIT;
