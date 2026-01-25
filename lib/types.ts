export type Mode = "CUSTOMER" | "SHOP_LOGIN" | "SHOP_APP";

export type MenuCategory = "อาหาร" | "ก๋วยเตี๋ยว" | "เครื่องดื่ม" | string;

export type MenuItem = {
  id: number;
  name_th: string;
  category: MenuCategory;
  price_thb: number;
  stock: number;
  description?: string | null;
  image_url?: string | null;
  is_active: boolean;
  created_at?: string;
};

export type OrderStatus = "NEW" | "ACCEPTED" | "SERVED" | "CANCELLED";

export type OrderItemPayload = {
  menu_id: number;
  name_th: string;
  qty: number;
  base_price_thb: number;
  options: Record<string, string>;
  note: string;
  extra_thb: number;
  unit_total_thb: number;
};

export type OrderRow = {
  id: number;
  session_id: string;
  table_no: string;
  status: OrderStatus;
  items: any;
  total_thb: number;
  created_at?: string;
  updated_at?: string;
};
