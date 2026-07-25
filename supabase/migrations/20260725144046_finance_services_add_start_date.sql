-- Lets a subscription's real-world start date differ from when the record
-- was added to Onyx, so recurring-payment backfill (see
-- app/features/subscriptions/lib/subscriptions.ts) anchors on the actual
-- subscription start instead of created_at.
alter table public.finance_services
  add column if not exists start_date date;

update public.finance_services
  set start_date = created_at::date
  where start_date is null;
