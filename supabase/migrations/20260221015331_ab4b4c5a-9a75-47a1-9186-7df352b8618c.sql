
CREATE OR REPLACE FUNCTION public.increment_points(p_user_id UUID, p_points BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.balances
  SET points = points + p_points,
      total_earned = total_earned + p_points
  WHERE user_id = p_user_id;
  
  UPDATE public.users
  SET total_points = total_points + p_points,
      level = GREATEST(1, FLOOR((total_points + p_points) / 10000)::INTEGER + 1)
  WHERE id = p_user_id;
END;
$$;
