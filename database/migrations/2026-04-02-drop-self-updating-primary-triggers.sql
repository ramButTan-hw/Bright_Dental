-- Remove self-updating one-primary triggers that cause MySQL ER 1442.
-- Primary insurance/pharmacy behavior is enforced in application transactions.

DROP TRIGGER IF EXISTS before_insurance_insert_one_primary;
DROP TRIGGER IF EXISTS before_insurance_update_one_primary;
DROP TRIGGER IF EXISTS before_patient_pharmacy_insert_one_primary;
DROP TRIGGER IF EXISTS before_patient_pharmacy_update_one_primary;
