ALTER TABLE public.ledger_entries DISABLE TRIGGER trg_ledger_entries_no_update;

-- Fill pet from the membership on the entry
UPDATE public.ledger_entries le
SET pet_id = m.pet_id
FROM public.memberships m
WHERE le.pet_id IS NULL AND le.membership_id = m.id AND m.pet_id IS NOT NULL;

-- Fill pet via the accrual's membership
UPDATE public.ledger_entries le
SET pet_id = m.pet_id, membership_id = COALESCE(le.membership_id, a.membership_id)
FROM public.direct_pay_accruals a
JOIN public.memberships m ON m.id = a.membership_id
WHERE le.pet_id IS NULL AND le.accrual_id = a.id AND m.pet_id IS NOT NULL;

UPDATE public.ledger_entries le
SET pet_id = m.pet_id, membership_id = COALESCE(le.membership_id, a.membership_id)
FROM public.member_reserve_accruals a
JOIN public.memberships m ON m.id = a.membership_id
WHERE le.pet_id IS NULL AND le.accrual_id = a.id AND m.pet_id IS NOT NULL;

-- Fill pet via the ticket
UPDATE public.ledger_entries le
SET pet_id = t.pet_id
FROM public.vet_tickets t
WHERE le.pet_id IS NULL AND le.ticket_id = t.id AND t.pet_id IS NOT NULL;

-- Fill pet via the obligation
UPDATE public.ledger_entries le
SET pet_id = o.pet_id
FROM public.bnpl_obligations o
WHERE le.pet_id IS NULL AND le.obligation_id = o.id AND o.pet_id IS NOT NULL;

-- Last resort: the owner's only membership pet
UPDATE public.ledger_entries le
SET pet_id = sub.pet_id
FROM (
  SELECT user_id, MIN(pet_id::text)::uuid AS pet_id, COUNT(DISTINCT pet_id) AS n
  FROM public.memberships GROUP BY user_id
) sub
WHERE le.pet_id IS NULL AND le.user_id = sub.user_id AND sub.n = 1;

ALTER TABLE public.ledger_entries ENABLE TRIGGER trg_ledger_entries_no_update;