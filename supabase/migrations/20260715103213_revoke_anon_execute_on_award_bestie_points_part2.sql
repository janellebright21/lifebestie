REVOKE EXECUTE ON FUNCTION award_bestie_points(text, text, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION award_bestie_points(text, text, integer, text) FROM anon;
GRANT  EXECUTE ON FUNCTION award_bestie_points(text, text, integer, text) TO authenticated;