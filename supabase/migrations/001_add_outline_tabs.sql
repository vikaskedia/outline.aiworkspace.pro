-- Migration: Add tab support to outlines table
-- This migration adds tab_order and is_default columns to support multiple outline tabs per workspace

-- Add new columns to outlines table
ALTER TABLE outlines 
ADD COLUMN IF NOT EXISTS tab_order integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false NOT NULL;

-- Create index for efficient tab ordering queries
CREATE INDEX IF NOT EXISTS outlines_tab_order_idx ON outlines(workspace_id, tab_order);

-- Update existing outlines to have tab_order and mark first outline per workspace as default
UPDATE outlines 
SET tab_order = 0, is_default = true
WHERE id IN (
    SELECT DISTINCT ON (workspace_id) id
    FROM outlines
    ORDER BY workspace_id, id ASC
);

-- Update remaining outlines to have proper tab_order
WITH ordered_outlines AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY id) - 1 as new_order
    FROM outlines
)
UPDATE outlines 
SET tab_order = ordered_outlines.new_order
FROM ordered_outlines
WHERE outlines.id = ordered_outlines.id;

-- Add comment explaining the new columns
COMMENT ON COLUMN outlines.tab_order IS 'Order of tabs within a workspace (0-based)';
COMMENT ON COLUMN outlines.is_default IS 'Whether this is the default/main outline for the workspace';
