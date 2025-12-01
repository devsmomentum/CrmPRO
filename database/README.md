# Database Implementation

This folder contains the database schema and migration scripts for the CRM application.

## Structure

- `schema.sql`: The complete database schema definition, including tables, relationships, and Row Level Security (RLS) policies.
- `migrations/`: Folder for versioned database migrations (future use).

## Setup

To initialize the database, run the contents of `schema.sql` in your PostgreSQL instance.

### Row Level Security (RLS)

The schema implements RLS to ensure data isolation between companies (multi-tenancy).
The function `get_current_empresa_id()` relies on the session variable `app.current_empresa_id`.
Ensure your application backend sets this variable upon user authentication.

Example:
```sql
SET app.current_empresa_id = '123';
SET app.current_user_id = '456';
```
