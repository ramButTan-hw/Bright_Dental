-- Add fee_note column to invoices to record automatic penalty fee reasons
ALTER TABLE invoices
  ADD COLUMN fee_note VARCHAR(100) NULL DEFAULT NULL AFTER payment_status;
