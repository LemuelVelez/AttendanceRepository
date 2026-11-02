-- Reference migration; main Go MigrateWithProgress handles schema deployment.
CREATE TABLE IF NOT EXISTS penalyze_sync_states (
  upload_id varchar(36) PRIMARY KEY,
  status varchar(16) NOT NULL CHECK (status IN ('pending', 'uploaded')),
  marked_pending_at timestamptz,
  marked_pending_by varchar(255) NOT NULL DEFAULT '',
  uploaded_at timestamptz,
  uploaded_by varchar(255) NOT NULL DEFAULT '',
  penalyze_import_id varchar(36),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_penalyze_sync_states_status ON penalyze_sync_states(status);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_penalyze_sync_states_upload_id' AND conrelid = 'penalyze_sync_states'::regclass) THEN
    ALTER TABLE penalyze_sync_states ADD CONSTRAINT fk_penalyze_sync_states_upload_id
      FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE;
  END IF;
END $$;
