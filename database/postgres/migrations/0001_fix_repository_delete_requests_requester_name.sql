-- Safely add requester_name and requester_office to existing repository_delete_requests rows

ALTER TABLE repository_delete_requests
ADD COLUMN IF NOT EXISTS requester_name VARCHAR(255);

UPDATE repository_delete_requests
SET requester_name = 'Unknown'
WHERE requester_name IS NULL;

ALTER TABLE repository_delete_requests
ALTER COLUMN requester_name SET NOT NULL;

ALTER TABLE repository_delete_requests
ADD COLUMN IF NOT EXISTS requester_office VARCHAR(255);

UPDATE repository_delete_requests
SET requester_office = 'Unknown'
WHERE requester_office IS NULL;

ALTER TABLE repository_delete_requests
ALTER COLUMN requester_office SET NOT NULL;
