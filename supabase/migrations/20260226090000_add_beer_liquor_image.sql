-- Add optional image column to beer_liquor_list
ALTER TABLE public.beer_liquor_list ADD COLUMN image TEXT;
COMMENT ON COLUMN public.beer_liquor_list.image IS 'Public URL of product image (optional)';
