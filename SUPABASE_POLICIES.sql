-- The Wood - Required policies for Shop actions
-- Run in Supabase SQL Editor

-- 0) Ensure columns exist
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cancelled_at_ms BIGINT,
ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 1) menu_items: allow authenticated users to UPDATE (stock / is_active)
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop can update menu" ON public.menu_items;
CREATE POLICY "shop can update menu"
ON public.menu_items
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 2) menu_items: allow authenticated users to INSERT (add menu)
DROP POLICY IF EXISTS "shop can insert menu" ON public.menu_items;
CREATE POLICY "shop can insert menu"
ON public.menu_items
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3) orders: allow authenticated users to UPDATE (accept/serve/cancel)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop can update orders" ON public.orders;
CREATE POLICY "shop can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
