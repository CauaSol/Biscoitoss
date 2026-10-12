-- Chelle's Biscoitos - banco e operações de venda
-- Execute no SQL Editor do MESMO projeto Supabase já usado pelo site.
-- Aviso: sem login, qualquer pessoa que tenha o endereço público pode tentar
-- ler os dados e chamar as operações disponíveis. Use apenas se aceitar esse risco.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null check (price > 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total numeric(10,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

alter table public.sales add column if not exists status text not null default 'completed';
alter table public.sales add column if not exists cancelled_at timestamptz;
alter table public.sales drop constraint if exists sales_status_check;
alter table public.sales add constraint sales_status_check check (status in ('completed','cancelled'));

alter table public.products enable row level security;
alter table public.sales enable row level security;

-- Policies públicas para o uso sem login. O catálogo/histórico não são privados.
drop policy if exists "Public can read products" on public.products;
create policy "Public can read products" on public.products for select to anon, authenticated using (true);
drop policy if exists "Public can add products" on public.products;
create policy "Public can add products" on public.products for insert to anon, authenticated with check (true);
drop policy if exists "Public can read sales" on public.sales;
create policy "Public can read sales" on public.sales for select to anon, authenticated using (true);

create or replace function public.register_sale(p_product_id uuid, p_quantity integer)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_sale public.sales%rowtype;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantidade inválida';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  if v_product.stock < p_quantity then raise exception 'Estoque insuficiente'; end if;

  update public.products set stock = stock - p_quantity where id = p_product_id;
  insert into public.sales(product_id, product_name, quantity, unit_price, total, status)
  values (v_product.id, v_product.name, p_quantity, v_product.price, v_product.price * p_quantity, 'completed')
  returning * into v_sale;
  return v_sale;
end;
$$;

create or replace function public.cancel_sale(p_sale_id uuid)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  if v_sale.status = 'cancelled' then raise exception 'Esta venda já foi cancelada'; end if;

  if v_sale.product_id is not null then
    update public.products set stock = stock + v_sale.quantity where id = v_sale.product_id;
  end if;
  update public.sales set status = 'cancelled', cancelled_at = now() where id = p_sale_id returning * into v_sale;
  return v_sale;
end;
$$;

revoke all on function public.register_sale(uuid, integer) from public;
grant execute on function public.register_sale(uuid, integer) to anon, authenticated;
revoke all on function public.cancel_sale(uuid) from public;
grant execute on function public.cancel_sale(uuid) to anon, authenticated;

-- A aplicação usa RPC para vender/cancelar; não permita gravações diretas na tabela sales.
revoke insert, update, delete on public.sales from anon, authenticated;
-- A aplicação só precisa inserir produtos; não permita alterações arbitrárias no estoque via tabela.
revoke update, delete on public.products from anon, authenticated;
