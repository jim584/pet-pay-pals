CREATE OR REPLACE FUNCTION public.guard_vet_account_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  _is_admin := public.has_role(auth.uid(), 'admin'::app_role);

  IF _is_admin THEN
    IF TG_OP = 'UPDATE' AND NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      NEW.identity_reviewed_at := now();
      NEW.identity_verified_by := auth.uid();
      NEW.is_approved := (NEW.account_status = 'verified');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.account_status := 'pending_verification';
    NEW.is_approved := false;
    NEW.identity_photo_path := NULL;
    NEW.identity_photo_captured_at := NULL;
    NEW.identity_verified_by := NULL;
    NEW.identity_reviewed_at := NULL;
    NEW.account_rejection_reason := NULL;
    NEW.license_db_match := NULL;
  ELSE
    NEW.account_status := OLD.account_status;
    NEW.is_approved := OLD.is_approved;
    NEW.identity_photo_path := OLD.identity_photo_path;
    NEW.identity_photo_captured_at := OLD.identity_photo_captured_at;
    NEW.identity_verified_by := OLD.identity_verified_by;
    NEW.identity_reviewed_at := OLD.identity_reviewed_at;
    NEW.account_rejection_reason := OLD.account_rejection_reason;
    NEW.license_db_match := OLD.license_db_match;
  END IF;

  RETURN NEW;
END;
$$;