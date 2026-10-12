-- Separate commit boundary: PostgreSQL must commit an enum value before using it.
ALTER TYPE "cosmetic_type" ADD VALUE 'BADGE';
