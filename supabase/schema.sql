-- ==========================================================
-- FINWISE FINANCIAL TRACKER & MANAGEMENT TOOL - DATABASE SCHEMA
-- Execute this script in your Supabase Project's SQL Editor
-- ==========================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------
-- 1. PROFILES TABLE (Linked with Supabase Auth users)
-- ----------------------------------------------------------
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text,
    email text,
    currency text default 'USD',
    monthly_income numeric(12, 2) default 0.00,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Users can view own profile" 
    on public.profiles for select 
    using (auth.uid() = id);

create policy "Users can update own profile" 
    on public.profiles for update 
    using (auth.uid() = id);

create policy "Users can insert own profile" 
    on public.profiles for insert 
    with check (auth.uid() = id);

-- ----------------------------------------------------------
-- 2. TRANSACTIONS TABLE
-- ----------------------------------------------------------
create table if not exists public.transactions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    title text not null,
    amount numeric(12, 2) not null check (amount > 0),
    type text not null check (type in ('income', 'expense')),
    category text not null,
    date date not null default current_date,
    notes text,
    is_recurring boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for efficient user queries
create index if not exists idx_transactions_user_date on public.transactions (user_id, date desc);

-- Enable RLS
alter table public.transactions enable row level security;

-- Policies for Transactions
create policy "Users can view own transactions" 
    on public.transactions for select 
    using (auth.uid() = user_id);

create policy "Users can insert own transactions" 
    on public.transactions for insert 
    with check (auth.uid() = user_id);

create policy "Users can update own transactions" 
    on public.transactions for update 
    using (auth.uid() = user_id);

create policy "Users can delete own transactions" 
    on public.transactions for delete 
    using (auth.uid() = user_id);

-- ----------------------------------------------------------
-- 3. BUDGETS TABLE
-- ----------------------------------------------------------
create table if not exists public.budgets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    category text not null,
    monthly_limit numeric(12, 2) not null check (monthly_limit >= 0),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_user_category unique (user_id, category)
);

-- Enable RLS
alter table public.budgets enable row level security;

-- Policies for Budgets
create policy "Users can view own budgets" 
    on public.budgets for select 
    using (auth.uid() = user_id);

create policy "Users can insert own budgets" 
    on public.budgets for insert 
    with check (auth.uid() = user_id);

create policy "Users can update own budgets" 
    on public.budgets for update 
    using (auth.uid() = user_id);

create policy "Users can delete own budgets" 
    on public.budgets for delete 
    using (auth.uid() = user_id);

-- ----------------------------------------------------------
-- 4. SAVINGS GOALS TABLE
-- ----------------------------------------------------------
create table if not exists public.savings_goals (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    title text not null,
    target_amount numeric(12, 2) not null check (target_amount > 0),
    current_amount numeric(12, 2) default 0.00 check (current_amount >= 0),
    target_date date,
    category text default 'General',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.savings_goals enable row level security;

-- Policies for Savings Goals
create policy "Users can view own savings goals" 
    on public.savings_goals for select 
    using (auth.uid() = user_id);

create policy "Users can insert own savings goals" 
    on public.savings_goals for insert 
    with check (auth.uid() = user_id);

create policy "Users can update own savings goals" 
    on public.savings_goals for update 
    using (auth.uid() = user_id);

create policy "Users can delete own savings goals" 
    on public.savings_goals for delete 
    using (auth.uid() = user_id);

-- ----------------------------------------------------------
-- 5. AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
-- ----------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, full_name, email, currency)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', 'User'),
        new.email,
        'USD'
    );
    return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
