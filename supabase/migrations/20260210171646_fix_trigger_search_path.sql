-- Fix mutable search_path on product table trigger functions
-- Resolves Supabase security advisor warning: function_search_path_mutable

ALTER FUNCTION public.update_prep_recipes_search_vector()
  SET search_path = public;

ALTER FUNCTION public.update_plate_specs_search_vector()
  SET search_path = public;

ALTER FUNCTION public.update_foh_plate_specs_search_vector()
  SET search_path = public;

ALTER FUNCTION public.update_wines_search_vector()
  SET search_path = public;

ALTER FUNCTION public.update_cocktails_search_vector()
  SET search_path = public;

ALTER FUNCTION public.update_beer_liquor_search_vector()
  SET search_path = public;
