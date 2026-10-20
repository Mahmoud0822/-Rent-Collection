create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.member_role as enum ('manager','staff');
create type public.invoice_kind as enum ('deposit','rent');
create type public.payment_method as enum ('cash','bank_transfer','online');
create type public.payment_status as enum ('pending_verification','approved','rejected','voided');
create type public.bill_status as enum ('pending','paid','failed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null
);
create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role public.member_role not null
);
create table public.units (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  name text not null, unique(org_id,name), unique(id,org_id)
);
create table public.tenants (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  user_id uuid not null unique references auth.users(id), full_name text not null, email text not null,
  phone text, unique(id,org_id)
);
create table public.leases (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  unit_id uuid not null, tenant_id uuid not null, start_date date not null, end_date date not null,
  monthly_rent_sen bigint not null check(monthly_rent_sen > 0), deposit_sen bigint not null check(deposit_sen >= 0),
  created_at timestamptz not null default now(),
  foreign key(unit_id,org_id) references public.units(id,org_id),
  foreign key(tenant_id,org_id) references public.tenants(id,org_id),
  check(end_date >= start_date), unique(id,org_id),
  exclude using gist (unit_id with =, daterange(start_date,end_date,'[]') with &&)
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id), lease_id uuid not null,
  kind public.invoice_kind not null, period_index integer, period_start date, period_end date,
  due_date date not null, amount_sen bigint not null check(amount_sen > 0), reference text,
  created_at timestamptz not null default now(),
  foreign key(lease_id,org_id) references public.leases(id,org_id) on delete cascade,
  check((kind='deposit' and period_index is null and period_start is null and period_end is null) or
        (kind='rent' and period_index >= 0 and period_start is not null and period_end >= period_start)),
  unique(lease_id,kind,period_index), unique(id,org_id)
);
create table public.gateway_bills (
  id text primary key, org_id uuid not null references public.organizations(id), lease_id uuid not null,
  amount_sen bigint not null check(amount_sen > 0), status public.bill_status not null default 'pending',
  created_at timestamptz not null default now(), foreign key(lease_id,org_id) references public.leases(id,org_id), unique(id,org_id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id), lease_id uuid not null,
  amount_sen bigint not null check(amount_sen > 0), unapplied_sen bigint not null default 0 check(unapplied_sen >= 0),
  method public.payment_method not null, status public.payment_status not null, received_at timestamptz not null,
  slip_path text, gateway_bill_id text, created_by uuid references auth.users(id), rejection_reason text,
  created_at timestamptz not null default now(), foreign key(lease_id,org_id) references public.leases(id,org_id),
  foreign key(gateway_bill_id,org_id) references public.gateway_bills(id,org_id), unique(id,org_id), unique(gateway_bill_id,org_id),
  check((method='online') or (unapplied_sen=0)), check((method='bank_transfer') or slip_path is null)
);
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  payment_id uuid not null, invoice_id uuid not null, amount_sen bigint not null check(amount_sen > 0),
  foreign key(payment_id,org_id) references public.payments(id,org_id), foreign key(invoice_id,org_id) references public.invoices(id,org_id),
  unique(payment_id,invoice_id)
);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  actor_id uuid references auth.users(id), action text not null, entity_id text not null,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index leases_org_idx on public.leases(org_id);
create index invoices_lease_due_idx on public.invoices(lease_id,due_date);
create index payments_lease_status_idx on public.payments(lease_id,status);
create index allocations_invoice_idx on public.payment_allocations(invoice_id);

create function public.current_org_id() returns uuid language sql stable security definer set search_path=public,pg_temp
as $$ select org_id from public.memberships where user_id=auth.uid() $$;
create function public.is_org_member(target_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.memberships where user_id=auth.uid() and org_id=target_org) $$;
create function public.is_org_manager(target_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.memberships where user_id=auth.uid() and org_id=target_org and role='manager') $$;
create function public.owns_lease(target_lease uuid) returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.leases l join public.tenants t on t.id=l.tenant_id where l.id=target_lease and t.user_id=auth.uid()) $$;
revoke all on function public.current_org_id(),public.is_org_member(uuid),public.is_org_manager(uuid),public.owns_lease(uuid) from public,anon;
grant execute on function public.current_org_id(),public.is_org_member(uuid),public.is_org_manager(uuid),public.owns_lease(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.gateway_bills enable row level security;
alter table public.audit_log enable row level security;

create policy org_read on public.organizations for select to authenticated using(public.is_org_member(id) or exists(select 1 from public.tenants t where t.org_id=id and t.user_id=auth.uid()));
create policy memberships_read on public.memberships for select to authenticated using(public.is_org_member(org_id));
create policy units_read on public.units for select to authenticated using(public.is_org_member(org_id) or exists(select 1 from public.leases l where l.unit_id=id and public.owns_lease(l.id)));
create policy tenants_read on public.tenants for select to authenticated using(user_id=auth.uid() or public.is_org_member(org_id));
create policy tenants_phone_update on public.tenants for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant update(phone) on public.tenants to authenticated;
create policy leases_read on public.leases for select to authenticated using(public.is_org_member(org_id) or public.owns_lease(id));
create policy invoices_read on public.invoices for select to authenticated using(public.is_org_member(org_id) or public.owns_lease(lease_id));
create policy payments_read on public.payments for select to authenticated using(public.is_org_member(org_id) or public.owns_lease(lease_id));
create policy allocations_read on public.payment_allocations for select to authenticated using(public.is_org_member(org_id) or exists(select 1 from public.invoices i where i.id=invoice_id and public.owns_lease(i.lease_id)));
create policy bills_read on public.gateway_bills for select to authenticated using(public.is_org_member(org_id) or public.owns_lease(lease_id));
create policy audit_read on public.audit_log for select to authenticated using(public.is_org_manager(org_id));

revoke all on all tables in schema public from public,anon;
revoke all on all sequences in schema public from public,anon;
grant usage on schema public to authenticated;
grant select on public.organizations,public.memberships,public.units,public.tenants,public.leases,public.invoices,public.payments,public.payment_allocations,public.gateway_bills,public.audit_log to authenticated;
revoke all on all tables in schema public from anon;
revoke insert,update,delete,truncate on public.organizations,public.memberships,public.units,public.leases,public.invoices,public.payments,public.payment_allocations,public.gateway_bills,public.audit_log from anon,authenticated;
revoke insert,update,delete,truncate on public.audit_log from public,anon,authenticated,service_role;

create function public.deny_audit_mutation() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception 'audit_log is append-only'; end $$;
revoke all on function public.deny_audit_mutation() from public,anon,authenticated,service_role;
create trigger audit_no_update_delete before update or delete on public.audit_log for each row execute function public.deny_audit_mutation();
create trigger audit_no_truncate before truncate on public.audit_log for each statement execute function public.deny_audit_mutation();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-slips','payment-slips',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','application/pdf'];
create policy slips_read on storage.objects for select to authenticated using(bucket_id='payment-slips' and public.is_org_member((storage.foldername(name))[1]::uuid));
create policy slips_upload on storage.objects for insert to authenticated with check(bucket_id='payment-slips' and public.is_org_member((storage.foldername(name))[1]::uuid));
create policy slips_update_deny on storage.objects for update to authenticated using(false);
create policy slips_delete_deny on storage.objects for delete to authenticated using(false);
