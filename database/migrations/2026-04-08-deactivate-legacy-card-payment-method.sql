-- Deactivate the legacy generic CARD payment method on the deployed database.
-- Credit Card and Debit Card remain available for checkout, and historical
-- payments keep their foreign key reference intact.

UPDATE payment_methods
SET is_active = 0
WHERE method_name = 'CARD';