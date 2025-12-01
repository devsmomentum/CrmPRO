-- Update the role for 'raicelys.sagitario11@gmail.com' to 'admin'
UPDATE empresa_miembros
SET role = 'admin'
WHERE email = 'raicelys.sagitario11@gmail.com';

-- Verify the update
SELECT *
FROM empresa_miembros
WHERE email = 'raicelys.sagitario11@gmail.com';
