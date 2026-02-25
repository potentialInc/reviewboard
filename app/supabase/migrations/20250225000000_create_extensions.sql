-- Migration: Enable required extensions
-- ReviewBoard requires UUID generation for primary keys.

create extension if not exists "uuid-ossp";
