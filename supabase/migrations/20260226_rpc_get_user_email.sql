-- RPC to get user email by profile ID
-- Since auth.users is protected, we need a SECURITY DEFINER function
CREATE OR REPLACE FUNCTION get_user_email_by_id(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with creator (admin) privileges
AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = user_id LIMIT 1);
END;
$$;
