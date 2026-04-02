ALTER TABLE treatment_plans
  ADD COLUMN IF NOT EXISTS follow_up_required TINYINT(1) NOT NULL DEFAULT 0 AFTER priority,
  ADD COLUMN IF NOT EXISTS follow_up_date DATE NULL AFTER follow_up_required,
  ADD COLUMN IF NOT EXISTS follow_up_contacted_at DATETIME NULL AFTER follow_up_date,
  ADD COLUMN IF NOT EXISTS follow_up_contacted_by VARCHAR(50) NULL AFTER follow_up_contacted_at,
  ADD COLUMN IF NOT EXISTS follow_up_contact_note TEXT NULL AFTER follow_up_contacted_by;
