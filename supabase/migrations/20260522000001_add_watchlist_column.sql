-- Add is_watchlist column to predictions_filtered table
-- This enables Phase 3: Watchlist/Market Watch for near-miss predictions

ALTER TABLE predictions_filtered 
ADD COLUMN IF NOT EXISTS is_watchlist BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster watchlist queries
CREATE INDEX IF NOT EXISTS idx_predictions_filtered_watchlist 
ON predictions_filtered(is_watchlist) 
WHERE is_watchlist = true;
