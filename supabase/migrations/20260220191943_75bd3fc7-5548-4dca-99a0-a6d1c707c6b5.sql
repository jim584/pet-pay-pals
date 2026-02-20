
-- Pet stories table
CREATE TABLE public.pet_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  photo_urls TEXT[] DEFAULT '{}',
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Story likes
CREATE TABLE public.story_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.pet_stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

-- Story comments
CREATE TABLE public.story_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.pet_stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallets (each user has one wallet with two balances)
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  direct_pay_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallet transactions ledger
CREATE TYPE public.transaction_type AS ENUM ('donation_received', 'donation_sent', 'withdrawal', 'vet_payment', 'refund');

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  wallet_portion NUMERIC(12,2) NOT NULL DEFAULT 0,
  direct_pay_portion NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  related_story_id UUID REFERENCES public.pet_stories(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.pet_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE TRIGGER update_pet_stories_updated_at
BEFORE UPDATE ON public.pet_stories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create wallet on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Function to update like count
CREATE OR REPLACE FUNCTION public.update_story_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pet_stories SET likes_count = likes_count + 1 WHERE id = NEW.story_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pet_stories SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.story_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER on_story_like_change
AFTER INSERT OR DELETE ON public.story_likes
FOR EACH ROW EXECUTE FUNCTION public.update_story_likes_count();

-- Function to update comment count
CREATE OR REPLACE FUNCTION public.update_story_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pet_stories SET comments_count = comments_count + 1 WHERE id = NEW.story_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pet_stories SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.story_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER on_story_comment_change
AFTER INSERT OR DELETE ON public.story_comments
FOR EACH ROW EXECUTE FUNCTION public.update_story_comments_count();

-- Function to process donation (security definer)
CREATE OR REPLACE FUNCTION public.process_donation(
  _from_user_id UUID,
  _to_user_id UUID,
  _amount NUMERIC,
  _story_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _to_wallet_id UUID;
  _direct_pay NUMERIC;
  _wallet NUMERIC;
BEGIN
  -- 60% goes to Direct Pay, 40% to Wallet
  _direct_pay := ROUND(_amount * 0.6, 2);
  _wallet := _amount - _direct_pay;

  -- Get or create recipient wallet
  SELECT id INTO _to_wallet_id FROM public.wallets WHERE user_id = _to_user_id;
  IF _to_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id) VALUES (_to_user_id) RETURNING id INTO _to_wallet_id;
  END IF;

  -- Update recipient balances
  UPDATE public.wallets
  SET wallet_balance = wallet_balance + _wallet,
      direct_pay_balance = direct_pay_balance + _direct_pay
  WHERE id = _to_wallet_id;

  -- Record transaction
  INSERT INTO public.wallet_transactions (wallet_id, type, amount, wallet_portion, direct_pay_portion, description, related_story_id, from_user_id)
  VALUES (_to_wallet_id, 'donation_received', _amount, _wallet, _direct_pay, 'Donation received', _story_id, _from_user_id);
END;
$$;

-- PET STORIES RLS: everyone authenticated can read, authors CRUD own
CREATE POLICY "Anyone can view stories"
ON public.pet_stories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authors can insert stories"
ON public.pet_stories FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own stories"
ON public.pet_stories FOR UPDATE TO authenticated
USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete own stories"
ON public.pet_stories FOR DELETE TO authenticated
USING (auth.uid() = author_id);

-- STORY LIKES RLS
CREATE POLICY "Anyone can view likes"
ON public.story_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can like"
ON public.story_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
ON public.story_likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- STORY COMMENTS RLS
CREATE POLICY "Anyone can view comments"
ON public.story_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can comment"
ON public.story_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.story_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- WALLETS RLS: users see own wallet, admins see all
CREATE POLICY "Users can view own wallet"
ON public.wallets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
ON public.wallets FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- WALLET TRANSACTIONS RLS
CREATE POLICY "Users can view own transactions"
ON public.wallet_transactions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.wallets w WHERE w.id = wallet_transactions.wallet_id AND w.user_id = auth.uid()
));

-- Make pets publicly viewable by all authenticated users
CREATE POLICY "All users can view all pets"
ON public.pets FOR SELECT TO authenticated
USING (true);

-- Drop the owner-only view policy since we now want public profiles
DROP POLICY IF EXISTS "Owners can view own pets" ON public.pets;

-- Storage bucket for pet story photos
INSERT INTO storage.buckets (id, name, public) VALUES ('pet-photos', 'pet-photos', true);

CREATE POLICY "Authenticated users can upload pet photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view pet photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pet-photos');

CREATE POLICY "Users can delete own pet photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
