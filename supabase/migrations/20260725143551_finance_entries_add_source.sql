-- Distinguishes manually-logged ledger entries from ones auto-generated
-- by the recurring-payment backfill (see app/features/subscriptions/lib/subscriptions.ts).
alter table public.finance_entries
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'auto'));

create index if not exists finance_entries_service_occurred_idx
  on public.finance_entries (service_id, occurred_on);
