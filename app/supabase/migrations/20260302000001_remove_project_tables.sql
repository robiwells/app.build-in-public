-- Remove project tables feature: drop RLS policies then tables (reverse dependency order)

DROP POLICY IF EXISTS "table_cells_owner"     ON project_table_cells;
DROP POLICY IF EXISTS "table_cells_select"    ON project_table_cells;
DROP POLICY IF EXISTS "table_rows_owner"      ON project_table_rows;
DROP POLICY IF EXISTS "table_rows_select"    ON project_table_rows;
DROP POLICY IF EXISTS "table_columns_owner"  ON project_table_columns;
DROP POLICY IF EXISTS "table_columns_select" ON project_table_columns;
DROP POLICY IF EXISTS "tables_owner_write"    ON project_tables;
DROP POLICY IF EXISTS "tables_select"         ON project_tables;

DROP TABLE IF EXISTS project_table_cells;
DROP TABLE IF EXISTS project_table_rows;
DROP TABLE IF EXISTS project_table_columns;
DROP TABLE IF EXISTS project_tables;
