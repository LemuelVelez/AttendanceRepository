ALTER TABLE uploads
ADD COLUMN IF NOT EXISTS representative_name varchar(255);

UPDATE uploads
SET representative_name = CASE
    WHEN original_name ~ '^.+ - College Representative: .+\.xlsx$'
        THEN BTRIM(substring(original_name from ' - College Representative: (.+)\.xlsx$'))
    ELSE ''
END
WHERE representative_name IS NULL;

ALTER TABLE uploads
ALTER COLUMN representative_name SET NOT NULL;
