-- Backfill the follow-up columns for older databases.
-- The admin follow-up queue expects this column to exist.

SET @follow_up_required_exists := (
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'treatment_plans'
            AND COLUMN_NAME = 'follow_up_required'
);

SET @sql := IF(
        @follow_up_required_exists = 0,
        'ALTER TABLE treatment_plans ADD COLUMN follow_up_required TINYINT(1) NOT NULL DEFAULT 0',
        'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @follow_up_date_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'treatment_plans'
      AND COLUMN_NAME = 'follow_up_date'
);

SET @sql := IF(
    @follow_up_date_exists = 0,
    'ALTER TABLE treatment_plans ADD COLUMN follow_up_date DATE NULL',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;