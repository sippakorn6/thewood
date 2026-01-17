import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * app/index.tsx (single-file)
 * - Expo Router / React Native Web friendly
 * - CUSTOMER / SHOP_LOGIN / SHOP_APP (hard-guard)
 * - Typing Lock System: stops polling + heavy setState while typing
 * - Shop polling with diff-check (no useless re-render)
 * - Cancel Order + Return Stock (CANCELLED)
 * - Realtime menu search + category filter
 * - Merge duplicate cart lines (same item+options+note)
 * - Minimal light-blue UI + horizontal category chips
 *
 * NOTE (Vercel/Expo Web): put keys in .env
 *  EXPO_PUBLIC_SUPABASE_URL=
 *  EXPO_PUBLIC_SUPABASE_ANON_KEY=
 *
 * Supabase SQL (run in SQL editor) for features used here:
 *
 * -- 1) Cancel Order fields + status
 * alter table public.orders add column if not exists cancelled_at_ms bigint;
 * alter table public.orders add column if not exists cancel_reason text;
 * -- (If you use a Postgres enum for status, add CANCELLED there instead.)
 *
 * -- 2) Soft-delete menu items (optional)
 * alter table public.menu_items add column if not exists is_active boolean default true;
 */

// -------------------- Supabase --------------------
const SUPABASE_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL as string) ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
  "";
const SUPABASE_ANON =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ||
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
  "";

function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    // Fail fast in production. This is safer than silently using wrong keys.
    throw new Error(
      "Missing Supabase env. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON);
}

// -------------------- Theme --------------------
const THEME = {
  bg: "#F6FBFF",
  card: "#FFFFFF",
  soft: "#EAF4FF",
  line: "rgba(15, 60, 110, 0.12)",
  text: "#0B2230",
  sub: "rgba(11,34,48,0.68)",
  primary: "#5AA9FF",
  primary2: "#2E7DFF",
  ok: "#1FBF75",
  warn: "#FFB020",
  danger: "#FF4D4D",
};

// -------------------- Data helpers --------------------
type Mode = "CUSTOMER" | "SHOP_LOGIN" | "SHOP_APP";

type MenuItem = {
  id: string;
  name: string;
  desc?: string;
  category?: string;
  price: number;
  stock: number;
  image_url?: string;
  is_active?: boolean;
  created_at_ms?: number;
};

type OrderStatus = "NEW" | "ACCEPTED" | "SERVED" | "CANCELLED";

type OrderRow = {
  order_id: string;
  table_no: string;
  session_id: string;
  items_json: string;
  note?: string;
  status: OrderStatus;
  created_at_ms: number;
  accepted_at_ms?: number | null;
  served_at_ms?: number | null;
  cancelled_at_ms?: number | null;
  cancel_reason?: string | null;
  total_price?: number;
};

type CartLine = {
  cart_key: string;
  menu_id: string;
  name: string;
  category: string;
  qty: number;
  base_price: number;
  final_price: number;
  protein?: string;
  protein_add?: number;
  noodle?: string;
  noodle_size?: string;
  noodle_size_add?: number;
  note?: string;
};

const CATEGORIES = ["ทั้งหมด", "อาหาร", "ก๋วยเตี๋ยว", "เครื่องดื่ม"] as const;

const FOOD_PROTEIN = [
  { label: "หมู", add: 0 },
  { label: "ไก่", add: 0 },
  { label: "เนื้อ", add: 10 },
  { label: "ทะเล", add: 20 },
] as const;

const NOODLES = ["เส้นเล็ก", "เส้นใหญ่", "บะหมี่เหลือง", "มาม่า"] as const;

const NOODLE_SIZES = [
  { label: "เล็ก", add: -10 },
  { label: "ธรรมดา", add: 0 },
  { label: "ใหญ่", add: 10 },
] as const;

function nowMs() {
  return Date.now();
}
function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function thb(n: any) {
  const x = Number(n || 0);
  return x.toLocaleString("th-TH");
}
function normalizeCategory(m: Partial<MenuItem>) {
  const c = (m?.category || "").trim();
  if (c === "อาหาร" || c === "ก๋วยเตี๋ยว" || c === "เครื่องดื่ม") return c;
  return "อาหาร";
}
function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    const x = JSON.parse(raw);
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

function makeCartKey(line: Omit<CartLine, "cart_key" | "qty"> & { qty?: number }) {
  const note = (line.note || "").trim();
  // normalize spacing/case for stable key
  const keyObj = {
    menu_id: line.menu_id,
    protein: line.protein || "",
    noodle: line.noodle || "",
    noodle_size: line.noodle_size || "",
    note: note,
  };
  return JSON.stringify(keyObj);
}

function orderListSignature(orders: OrderRow[]) {
  // Diff-check: only important fields
  const compact = orders.map((o) => ({
    order_id: o.order_id,
    status: o.status,
    created_at_ms: o.created_at_ms,
    accepted_at_ms: o.accepted_at_ms ?? null,
    served_at_ms: o.served_at_ms ?? null,
    cancelled_at_ms: o.cancelled_at_ms ?? null,
    total_price: Number(o.total_price || 0),
  }));
  return JSON.stringify(compact);
}

// -------------------- UI atoms --------------------
function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: THEME.primary, borderColor: "transparent" } : { backgroundColor: THEME.card },
      ]}
    >
      <Text style={[styles.chipText, active ? { color: "#fff" } : { color: THEME.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function PillButton({
  label,
  tone = "primary",
  onPress,
  disabled,
}: {
  label: string;
  tone?: "primary" | "soft" | "danger" | "ok";
  onPress?: () => void;
  disabled?: boolean;
}) {
  const bg =
    tone === "primary"
      ? THEME.primary2
      : tone === "danger"
      ? THEME.danger
      : tone === "ok"
      ? THEME.ok
      : THEME.soft;
  const fg = tone === "soft" ? THEME.text : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.55 : 1 },
        tone === "soft" ? { borderWidth: 1, borderColor: THEME.line } : null,
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// -------------------- App --------------------
export default function App() {
  const supabaseRef = useRef<SupabaseClient | null>(null);
  if (!supabaseRef.current) supabaseRef.current = getSupabase();
  const supabase = supabaseRef.current;

  // --------- Mode + Typing Lock ---------
  const [mode, setMode] = useState<Mode>("CUSTOMER");
  const [shopLoggedIn, setShopLoggedIn] = useState(false);
  // Typing Lock System (NO state updates on focus/blur => avoids web/iOS focus drop)
  const isTypingRef = useRef(false);
  const shopPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPollingNow = useCallback(() => {
    if (shopPollTimerRef.current) {
      clearTimeout(shopPollTimerRef.current);
      shopPollTimerRef.current = null;
    }
    if (customerPollTimerRef.current) {
      clearTimeout(customerPollTimerRef.current);
      customerPollTimerRef.current = null;
    }
  }, []);

  const onFocusAny = useCallback(() => {
    isTypingRef.current = true;
    // Stop polling immediately to prevent setState during typing.
    stopPollingNow();
  }, [stopPollingNow]);

  const onBlurAny = useCallback(() => {
    isTypingRef.current = false;
  }, []);

  // HARD GUARD: never render shop app unless logged in
  useEffect(() => {
    if (mode === "SHOP_APP" && !shopLoggedIn) setMode("SHOP_LOGIN");
  }, [mode, shopLoggedIn]);

  // Keep shopLoggedIn in sync with Supabase auth session
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) setShopLoggedIn(!!data?.session?.user);
      } catch {
        // ignore
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setShopLoggedIn(!!session?.user);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  // --------- Customer session/table ---------
  const [tableNo, setTableNo] = useState("");
  const [tableLocked, setTableLocked] = useState(false);
  const [sessionId, setSessionId] = useState(uid("sess"));

  // --------- Data ---------
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [servedHistory, setServedHistory] = useState<any[]>([]);

  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --------- UI state ---------
  const [customerTab, setCustomerTab] = useState<"MENU" | "CART" | "STATUS">("MENU");
  const [shopTab, setShopTab] = useState<"ORDERS" | "STOCK" | "HISTORY" | "STATS">("ORDERS");

  // QR table param support: /?table=5
  const params = useLocalSearchParams();
  useEffect(() => {
    const raw = (params as any)?.table;
    const t = Array.isArray(raw) ? raw[0] : raw;
    const next = String(t || "").trim();
    if (!next) return;

    // Auto-lock table + start fresh session (only if not locked yet)
    if (!tableLocked) {
      setTableNo(next);
      setTableLocked(true);
      setSessionId(uid("sess"));
      setCustomerTab("MENU");
    }
  }, [params, tableLocked]);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("ทั้งหมด");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState<CartLine[]>([]);

  // Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedMenu, setPickedMenu] = useState<MenuItem | null>(null);
  const [pickProtein, setPickProtein] = useState(FOOD_PROTEIN[0]);
  const [pickNoodle, setPickNoodle] = useState(NOODLES[0]);
  const [pickNoodleSize, setPickNoodleSize] = useState(NOODLE_SIZES[1]);
  const [pickNote, setPickNote] = useState("");

  // Add menu
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [mName, setMName] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mCategory, setMCategory] = useState<"อาหาร" | "ก๋วยเตี๋ยว" | "เครื่องดื่ม">("อาหาร");
  const [mPrice, setMPrice] = useState("");
  const [mStock, setMStock] = useState("10");
  const [mImageUrl, setMImageUrl] = useState("");

  // Shop login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Diff-check refs
  const lastOrdersSigRef = useRef<string>("");
  const lastMenuSigRef = useRef<string>("");

  // -------------------- Loaders --------------------
  const loadMenu = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingMenu(true);
      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("*")
          .order("created_at_ms", { ascending: false });
        if (error) throw error;
        const list = (Array.isArray(data) ? data : []) as MenuItem[];

        // diff check to reduce re-render
        const sig = JSON.stringify(
          list.map((m) => ({ id: m.id, stock: m.stock, price: m.price, is_active: m.is_active ?? true }))
        );
        if (sig !== lastMenuSigRef.current) {
          lastMenuSigRef.current = sig;
          setMenu(list);
        }
      } catch (e: any) {
        if (!opts?.silent) Alert.alert("โหลดเมนูไม่สำเร็จ", String(e?.message || e));
      } finally {
        if (!opts?.silent) setLoadingMenu(false);
      }
    },
    [supabase]
  );

  const loadOrders = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingOrders(true);
      try {
        let query = supabase.from("orders").select("*").order("created_at_ms", { ascending: false });
        if (mode === "CUSTOMER") query = query.eq("session_id", sessionId);

        const { data, error } = await query;
        if (error) throw error;
        const list = (Array.isArray(data) ? data : []) as OrderRow[];

        const sig = orderListSignature(list);
        if (sig !== lastOrdersSigRef.current) {
          lastOrdersSigRef.current = sig;
          setOrders(list);
        }
      } catch (e: any) {
        if (!opts?.silent) Alert.alert("โหลดออเดอร์ไม่สำเร็จ", String(e?.message || e));
      } finally {
        if (!opts?.silent) setLoadingOrders(false);
      }
    },
    [mode, sessionId, supabase]
  );

  const loadHistory = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from("served_history")
          .select("*")
          .order("served_at_ms", { ascending: false })
          .limit(200);
        if (error) throw error;
        setServedHistory(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!opts?.silent) Alert.alert("โหลดประวัติไม่สำเร็จ", String(e?.message || e));
      } finally {
        if (!opts?.silent) setLoadingHistory(false);
      }
    },
    [supabase]
  );

  // Initial load
  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    loadOrders({ silent: true });
  }, [loadOrders]);

  // -------------------- Polling (HARD-GUARDED + Typing Lock) --------------------
  // No setInterval. We use a self-scheduling timeout and skip ALL loads while typing.
  useEffect(() => {
    const shouldPollShop = mode === "SHOP_APP" && shopLoggedIn;
    if (!shouldPollShop) {
      if (shopPollTimerRef.current) {
        clearTimeout(shopPollTimerRef.current);
        shopPollTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      // Guard every tick (mode/auth can change between timeouts)
      if (!(mode === "SHOP_APP" && shopLoggedIn)) return;

      if (!isTypingRef.current) {
        // Silent refresh, diff-check prevents UI churn
        await loadOrders({ silent: true });
        await loadMenu({ silent: true });
        if (shopTab === "HISTORY" || shopTab === "STATS") {
          await loadHistory({ silent: true });
        }
      }

      shopPollTimerRef.current = setTimeout(tick, 2500);
    };

    // Quick first tick after entering SHOP_APP
    shopPollTimerRef.current = setTimeout(tick, 200);

    return () => {
      cancelled = true;
      if (shopPollTimerRef.current) {
        clearTimeout(shopPollTimerRef.current);
        shopPollTimerRef.current = null;
      }
    };
  }, [loadHistory, loadMenu, loadOrders, mode, shopLoggedIn, shopTab]);

  // Customer status polling (only when viewing STATUS) with Typing Lock
  useEffect(() => {
    const shouldPollCustomer = mode === "CUSTOMER" && tableLocked && customerTab === "STATUS";
    if (!shouldPollCustomer) {
      if (customerPollTimerRef.current) {
        clearTimeout(customerPollTimerRef.current);
        customerPollTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (!(mode === "CUSTOMER" && tableLocked && customerTab === "STATUS")) return;

      if (!isTypingRef.current) {
        await loadOrders({ silent: true });
      }

      customerPollTimerRef.current = setTimeout(tick, 3000);
    };

    customerPollTimerRef.current = setTimeout(tick, 250);

    return () => {
      cancelled = true;
      if (customerPollTimerRef.current) {
        clearTimeout(customerPollTimerRef.current);
        customerPollTimerRef.current = null;
      }
    };
  }, [customerTab, loadOrders, mode, tableLocked]);

  // -------------------- Customer: menu filters --------------------
  const filteredMenu = useMemo(() => {
    const kw = (search || "").trim().toLowerCase();
    return menu
      .filter((m) => (m.is_active ?? true) !== false)
      .filter((m) => (category === "ทั้งหมด" ? true : normalizeCategory(m) === category))
      .filter((m) => {
        if (!kw) return true;
        const hay = `${m.name || ""} ${m.desc || ""}`.toLowerCase();
        return hay.includes(kw);
      });
  }, [category, menu, search]);

  // -------------------- Cart helpers --------------------
  const cartTotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + Number(it.final_price || 0) * Number(it.qty || 1), 0);
  }, [cart]);

  const openPicker = useCallback((m: MenuItem) => {
    setPickedMenu(m);
    setPickProtein(FOOD_PROTEIN[0]);
    setPickNoodle(NOODLES[0]);
    setPickNoodleSize(NOODLE_SIZES[1]);
    setPickNote("");
    setPickerOpen(true);
  }, []);

  const addToCart = useCallback(() => {
    if (!pickedMenu) return;
    if (Number(pickedMenu.stock || 0) <= 0) return Alert.alert("สินค้าหมด", "เมนูนี้หมดสต็อกแล้ว");

    const base = Number(pickedMenu.price || 0);
    const add = Number(pickProtein.add || 0) + Number(pickNoodleSize.add || 0);
    const final = base + add;

    const lineNoKey: Omit<CartLine, "cart_key" | "qty"> = {
      menu_id: pickedMenu.id,
      name: pickedMenu.name,
      category: normalizeCategory(pickedMenu),
      base_price: base,
      final_price: final,
      protein: pickProtein.label,
      protein_add: Number(pickProtein.add || 0),
      noodle: pickNoodle,
      noodle_size: pickNoodleSize.label,
      noodle_size_add: Number(pickNoodleSize.add || 0),
      note: (pickNote || "").trim(),
    };

    const key = makeCartKey(lineNoKey);

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.cart_key === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { ...lineNoKey, cart_key: key, qty: 1 }];
    });

    setPickerOpen(false);
    setPickedMenu(null);
  }, [pickNoodle, pickNoodleSize, pickNote, pickProtein, pickedMenu]);

  const updateQty = useCallback((cart_key: string, delta: number) => {
    setCart((p) =>
      p
        .map((x) => (x.cart_key === cart_key ? { ...x, qty: Math.max(1, x.qty + delta) } : x))
        .filter((x) => x.qty > 0)
    );
  }, []);

  const removeCart = useCallback((cart_key: string) => {
    setCart((p) => p.filter((x) => x.cart_key !== cart_key));
  }, []);

  // -------------------- Customer: Table lock + reset --------------------
  const lockTable = useCallback(() => {
    const t = (tableNo || "").trim();
    if (!t) return Alert.alert("เลือกโต๊ะ", "กรุณาใส่หมายเลขโต๊ะ");
    setTableLocked(true);
  }, [tableNo]);

  const resetSession = useCallback(() => {
    Alert.alert("เริ่มใหม่", "ล้างตะกร้าและสร้าง session ใหม่?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "เริ่มใหม่",
        style: "destructive",
        onPress: () => {
          setCart([]);
          setTableNo("");
          setTableLocked(false);
          setSessionId(uid("sess"));
          setCustomerTab("MENU");
          // refresh orders for new session
          setOrders([]);
          lastOrdersSigRef.current = "";
        },
      },
    ]);
  }, []);

  // -------------------- Place order (atomic-ish with rollback) --------------------
  const placeOrder = useCallback(async () => {
    if (!tableLocked) return Alert.alert("ยังไม่ล็อกโต๊ะ", "กรุณาใส่หมายเลขโต๊ะและกดล็อกโต๊ะก่อน");
    if (cart.length === 0) return Alert.alert("ตะกร้าว่าง", "เลือกเมนูก่อน");

    const orderId = uid("order");
    const createdAt = nowMs();

    // include menu_id in items_json for future cancel/return stock
    const items = cart.map((x) => ({
      menu_id: x.menu_id,
      name: x.name,
      category: x.category,
      qty: x.qty,
      base_price: x.base_price,
      final_price: x.final_price,
      protein: x.protein,
      protein_add: x.protein_add,
      noodle: x.noodle,
      noodle_size: x.noodle_size,
      noodle_size_add: x.noodle_size_add,
      note: x.note,
    }));

    const payload: Partial<OrderRow> & { order_id: string } = {
      order_id: orderId,
      table_no: String(tableNo).trim(),
      session_id: sessionId,
      items_json: JSON.stringify(items),
      note: items.some((x) => (x.note || "").trim()) ? "มีโน้ต" : "",
      status: "NEW",
      created_at_ms: createdAt,
      accepted_at_ms: null,
      served_at_ms: null,
      cancelled_at_ms: null,
      cancel_reason: null,
      total_price: Number(cartTotal || 0),
    };

    try {
      // 1) insert order
      const { error: e1 } = await supabase.from("orders").insert(payload);
      if (e1) throw e1;

      // 2) update stock per line (best-effort) + rollback on failure
      for (const it of cart) {
        const m = menu.find((x) => x.id === it.menu_id);
        if (!m) continue;
        const newStock = Math.max(0, Number(m.stock || 0) - Number(it.qty || 1));
        const { error: e2 } = await supabase.from("menu_items").update({ stock: newStock }).eq("id", it.menu_id);
        if (e2) {
          // rollback: delete order record
          await supabase.from("orders").delete().eq("order_id", orderId);
          throw new Error("ตัดสต็อกไม่สำเร็จ (rollback ออเดอร์แล้ว)");
        }
      }

      setCart([]);
      setCustomerTab("STATUS");
      await loadMenu({ silent: true });
      await loadOrders({ silent: true });
      Alert.alert("สำเร็จ", "สั่งอาหารแล้ว ✅");
    } catch (e: any) {
      Alert.alert("สั่งไม่สำเร็จ", String(e?.message || e));
    }
  }, [cart, cartTotal, loadMenu, loadOrders, menu, sessionId, supabase, tableLocked, tableNo]);

  // -------------------- Shop auth --------------------
  const shopLogin = useCallback(async () => {
    const email = (loginEmail || "").trim();
    const password = loginPass || "";
    if (!email || !password) return Alert.alert("กรอกไม่ครบ", "ใส่อีเมลและรหัสผ่าน");

    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setShopLoggedIn(true);
      setMode("SHOP_APP");
      setShopTab("ORDERS");
      setLoginEmail("");
      setLoginPass("");
      await loadOrders({ silent: true });
      await loadMenu({ silent: true });
    } catch (e: any) {
      Alert.alert("เข้าสู่ระบบไม่สำเร็จ", String(e?.message || e));
    } finally {
      setLoginLoading(false);
    }
  }, [loadMenu, loadOrders, loginEmail, loginPass, supabase]);

  const shopLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setShopLoggedIn(false);
    setMode("CUSTOMER");
    setShopTab("ORDERS");
  }, [supabase]);

  // -------------------- Shop actions --------------------
  const acceptOrder = useCallback(
    async (o: OrderRow) => {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: "ACCEPTED", accepted_at_ms: nowMs() })
          .eq("order_id", o.order_id);
        if (error) throw error;
        await loadOrders({ silent: true });
      } catch (e: any) {
        Alert.alert("รับไม่สำเร็จ", String(e?.message || e));
      }
    },
    [loadOrders, supabase]
  );

  const serveOrder = useCallback(
    async (o: OrderRow) => {
      try {
        const servedAt = nowMs();
        const { error: e1 } = await supabase
          .from("orders")
          .update({ status: "SERVED", served_at_ms: servedAt })
          .eq("order_id", o.order_id);
        if (e1) throw e1;

        const { error: e2 } = await supabase.from("served_history").insert({
          id: uid("served"),
          order_id: o.order_id,
          table_no: o.table_no,
          session_id: o.session_id,
          items_json: o.items_json,
          note: o.note || "",
          served_at_ms: servedAt,
          total_price: Number(o.total_price || 0),
        });
        if (e2) throw e2;

        await loadOrders({ silent: true });
        await loadHistory({ silent: true });
      } catch (e: any) {
        Alert.alert("เสิร์ฟไม่สำเร็จ", String(e?.message || e));
      }
    },
    [loadHistory, loadOrders, supabase]
  );

  const cancelOrder = useCallback(
    async (o: OrderRow) => {
      if (!(o.status === "NEW" || o.status === "ACCEPTED")) return;

      // Optional reason (simple prompt)
      const doCancel = async (reason?: string) => {
        try {
          // 1) mark cancelled
          const { error: e1 } = await supabase
            .from("orders")
            .update({ status: "CANCELLED", cancelled_at_ms: nowMs(), cancel_reason: reason || null })
            .eq("order_id", o.order_id);
          if (e1) throw e1;

          // 2) return stock
          const items = safeJsonParse<any[]>(o.items_json || "[]", []);
          for (const it of items) {
            const qty = Math.max(0, Number(it?.qty || 0));
            if (qty <= 0) continue;

            // prefer menu_id, fallback by name
            const menuId: string | null = it?.menu_id || null;
            let target = menuId ? menu.find((m) => m.id === menuId) : null;
            if (!target && it?.name) {
              const nm = String(it.name).trim();
              target = menu.find((m) => (m.name || "").trim() === nm) || null;
            }
            if (!target) continue;

            const newStock = Number(target.stock || 0) + qty;
            await supabase.from("menu_items").update({ stock: newStock }).eq("id", target.id);
          }

          await loadMenu({ silent: true });
          await loadOrders({ silent: true });
        } catch (e: any) {
          Alert.alert("ยกเลิกไม่สำเร็จ", String(e?.message || e));
        }
      };

      Alert.alert("ยกเลิกออเดอร์", `ต้องการยกเลิกออเดอร์ ${o.order_id} ?`, [
        { text: "ไม่ยกเลิก", style: "cancel" },
        { text: "ยกเลิก", style: "destructive", onPress: () => void doCancel() },
      ]);
    },
    [loadMenu, loadOrders, menu, supabase]
  );

  const stockDelta = useCallback(
    async (m: MenuItem, delta: number) => {
      try {
        const next = Math.max(0, Number(m.stock || 0) + delta);
        const { error } = await supabase.from("menu_items").update({ stock: next }).eq("id", m.id);
        if (error) throw error;
        await loadMenu({ silent: true });
      } catch (e: any) {
        Alert.alert("ปรับสต็อกไม่สำเร็จ", String(e?.message || e));
      }
    },
    [loadMenu, supabase]
  );

  const addMenu = useCallback(async () => {
    const name = (mName || "").trim();
    const desc = (mDesc || "").trim();
    const price = Number(mPrice || 0);
    const stock = Number(mStock || 0);
    const image_url = (mImageUrl || "").trim();

    if (!name) return Alert.alert("กรอกไม่ครบ", "ใส่ชื่อเมนู");
    if (!Number.isFinite(price) || price <= 0) return Alert.alert("ราคาไม่ถูกต้อง", "ใส่ราคามากกว่า 0");

    try {
      const payload = {
        id: uid("menu"),
        name,
        desc,
        category: mCategory,
        price,
        stock: Number.isFinite(stock) ? stock : 0,
        image_url,
        is_active: true,
        created_at_ms: nowMs(),
      };
      const { error } = await supabase.from("menu_items").insert(payload);
      if (error) throw error;

      setAddMenuOpen(false);
      setMName("");
      setMDesc("");
      setMPrice("");
      setMStock("10");
      setMImageUrl("");
      await loadMenu({ silent: true });
    } catch (e: any) {
      Alert.alert("เพิ่มเมนูไม่สำเร็จ", String(e?.message || e));
    }
  }, [loadMenu, mCategory, mDesc, mImageUrl, mName, mPrice, mStock, supabase]);

  // -------------------- Shop stats --------------------
  const todayStats = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    const list = servedHistory.filter((x) => Number(x?.served_at_ms || 0) >= startMs);
    const total = list.reduce((acc, x) => acc + Number(x?.total_price || 0), 0);

    const top: Record<string, number> = {};
    for (const h of list) {
      const items = safeJsonParse<any[]>(h?.items_json || "[]", []);
      for (const it of items) {
        const nm = String(it?.name || "").trim();
        const qty = Number(it?.qty || 0);
        if (!nm || qty <= 0) continue;
        top[nm] = (top[nm] || 0) + qty;
      }
    }
    const topArr = Object.entries(top)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, count: list.length, topArr };
  }, [servedHistory]);

  // -------------------- Render helpers --------------------
  const goCustomer = useCallback(() => {
    setMode("CUSTOMER");
  }, []);

  const goShop = useCallback(() => {
    // ALWAYS go to login first
    setMode("SHOP_LOGIN");
  }, []);

  // -------------------- Views --------------------
  const Header = (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.hTitle}>TableWaiter</Text>
        <Text style={styles.hSub}>สั่งอาหาร • ร้านค้า • สต็อก</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <PillButton label="👤 CUSTOMER" tone={mode === "CUSTOMER" ? "primary" : "soft"} onPress={goCustomer} />
        <PillButton label="🏪 SHOP" tone={mode !== "CUSTOMER" ? "primary" : "soft"} onPress={goShop} />
      </View>
    </View>
  );

  // -------------------- SHOP_LOGIN screen (no modal) --------------------
  if (mode === "SHOP_LOGIN") {
    return (
      <SafeAreaView style={styles.root}>
        {Header}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.centerScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.title}>เข้าสู่ระบบร้านค้า</Text>
              <Text style={styles.sub}>ต้องล็อกอินก่อนถึงจะเข้าระบบร้านได้</Text>

              <Text style={styles.label}>อีเมล</Text>
              <TextInput
                value={loginEmail}
                onChangeText={setLoginEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="example@email.com"
                style={styles.input}
                onFocus={onFocusAny}
                onBlur={onBlurAny}
                autoCorrect={false}
              />

              <Text style={styles.label}>รหัสผ่าน</Text>
              <TextInput
                value={loginPass}
                onChangeText={setLoginPass}
                autoCapitalize="none"
                secureTextEntry
                placeholder="••••••••"
                style={styles.input}
                onFocus={onFocusAny}
                onBlur={onBlurAny}
                autoCorrect={false}
              />

              <Pressable
                style={[styles.bigBtn, loginLoading ? { opacity: 0.7 } : null]}
                onPress={shopLogin}
                disabled={loginLoading}
              >
                {loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigBtnText}>ล็อกอิน</Text>}
              </Pressable>

              <Pressable onPress={() => setMode("CUSTOMER")} style={{ marginTop: 12, alignItems: "center" }}>
                <Text style={{ color: THEME.sub, fontWeight: "800" }}>← กลับไปโหมดลูกค้า</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // -------------------- SHOP_APP (hard guard) --------------------
  if (mode === "SHOP_APP") {
    if (!shopLoggedIn) {
      // extra safety
      return null;
    }

    return (
      <SafeAreaView style={styles.root}>
        {Header}

        <View style={styles.tabRow}>
          <Chip label="ออเดอร์" active={shopTab === "ORDERS"} onPress={() => setShopTab("ORDERS")} />
          <Chip label="สต็อก" active={shopTab === "STOCK"} onPress={() => setShopTab("STOCK")} />
          <Chip label="ประวัติ" active={shopTab === "HISTORY"} onPress={() => setShopTab("HISTORY")} />
          <Chip label="สถิติ" active={shopTab === "STATS"} onPress={() => setShopTab("STATS")} />
          <View style={{ flex: 1 }} />
          <PillButton label="ออกจากระบบ" tone="soft" onPress={shopLogout} />
        </View>

        {shopTab === "ORDERS" && (
          <View style={{ flex: 1 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ออเดอร์ล่าสุด</Text>
              <PillButton label="รีเฟรช" tone="soft" onPress={() => loadOrders()} disabled={loadingOrders} />
            </View>

            {loadingOrders ? (
              <View style={styles.center}>
                <ActivityIndicator />
              </View>
            ) : (
              <FlatList
                data={orders}
                keyExtractor={(it) => it.order_id}
                contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
                renderItem={({ item }) => {
                  const items = safeJsonParse<any[]>(item.items_json || "[]", []);
                  const canCancel = item.status === "NEW" || item.status === "ACCEPTED";
                  return (
                    <View style={styles.orderCard}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={styles.orderTitle}>โต๊ะ {item.table_no}</Text>
                        <View style={{ flex: 1 }} />
                        <Text
                          style={[
                            styles.badge,
                            item.status === "NEW"
                              ? { backgroundColor: THEME.warn }
                              : item.status === "ACCEPTED"
                              ? { backgroundColor: THEME.primary }
                              : item.status === "SERVED"
                              ? { backgroundColor: THEME.ok }
                              : { backgroundColor: THEME.danger },
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>

                      <Text style={styles.orderSub}>#{item.order_id}</Text>

                      <View style={{ marginTop: 8, gap: 4 }}>
                        {items.map((x, idx) => (
                          <Text key={idx} style={styles.orderLine}>
                            • {x?.name} x{Number(x?.qty || 0)}
                            {x?.protein ? ` (${x.protein}` : ""}
                            {x?.noodle ? `, ${x.noodle}` : ""}
                            {x?.noodle_size ? `, ${x.noodle_size}` : ""}
                            {(x?.protein || x?.noodle || x?.noodle_size) ? ")" : ""}
                            {x?.note ? ` — ${String(x.note).trim()}` : ""}
                          </Text>
                        ))}
                      </View>

                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {item.status === "NEW" && (
                          <PillButton label="รับออเดอร์" tone="primary" onPress={() => acceptOrder(item)} />
                        )}
                        {item.status === "ACCEPTED" && (
                          <PillButton label="เสิร์ฟแล้ว" tone="ok" onPress={() => serveOrder(item)} />
                        )}
                        {canCancel && <PillButton label="ยกเลิก" tone="danger" onPress={() => cancelOrder(item)} />}
                      </View>

                      <Text style={[styles.orderSub, { marginTop: 10 }]}>รวม ฿{thb(item.total_price || 0)}</Text>
                      {item.status === "CANCELLED" && item.cancelled_at_ms ? (
                        <Text style={[styles.orderSub, { marginTop: 2 }]}>ยกเลิกแล้ว</Text>
                      ) : null}
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}

        {shopTab === "STOCK" && (
          <View style={{ flex: 1 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>สต็อกเมนู</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <PillButton label="เพิ่มเมนู" tone="primary" onPress={() => setAddMenuOpen(true)} />
                <PillButton label="รีเฟรช" tone="soft" onPress={() => loadMenu()} disabled={loadingMenu} />
              </View>
            </View>

            <FlatList
              data={menu.filter((m) => (m.is_active ?? true) !== false)}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View style={styles.stockCard}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stockName}>{item.name}</Text>
                      <Text style={styles.stockSub}>
                        {normalizeCategory(item)} • ฿{thb(item.price)}
                      </Text>
                    </View>
                    <Text style={styles.stockQty}>{Number(item.stock || 0)}</Text>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <PillButton label="-1" tone="soft" onPress={() => stockDelta(item, -1)} />
                    <PillButton label="+1" tone="soft" onPress={() => stockDelta(item, +1)} />
                    <PillButton label="หมด" tone="danger" onPress={() => stockDelta(item, -999999)} />
                  </View>
                </View>
              )}
            />
          </View>
        )}

        {shopTab === "HISTORY" && (
          <View style={{ flex: 1 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ประวัติที่เสิร์ฟแล้ว</Text>
              <PillButton label="รีเฟรช" tone="soft" onPress={() => loadHistory()} disabled={loadingHistory} />
            </View>

            {loadingHistory ? (
              <View style={styles.center}>
                <ActivityIndicator />
              </View>
            ) : (
              <FlatList
                data={servedHistory}
                keyExtractor={(it) => String(it.id || it.order_id || Math.random())}
                contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
                renderItem={({ item }) => (
                  <View style={styles.orderCard}>
                    <Text style={styles.orderTitle}>โต๊ะ {item.table_no}</Text>
                    <Text style={styles.orderSub}>รวม ฿{thb(item.total_price || 0)}</Text>
                  </View>
                )}
              />
            )}
          </View>
        )}

        {shopTab === "STATS" && (
          <View style={{ flex: 1 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>สถิติวันนี้</Text>
              <PillButton label="รีเฟรช" tone="soft" onPress={() => loadHistory()} />
            </View>

            <View style={{ padding: 12 }}>
              <View style={styles.card}>
                <Text style={styles.title}>ยอดรวมวันนี้</Text>
                <Text style={[styles.bigNumber, { marginTop: 6 }]}>฿{thb(todayStats.total)}</Text>
                <Text style={styles.sub}>จำนวนบิล: {todayStats.count}</Text>

                <View style={{ height: 1, backgroundColor: THEME.line, marginVertical: 12 }} />
                <Text style={[styles.title, { fontSize: 16 }]}>Top เมนู</Text>
                {todayStats.topArr.length === 0 ? (
                  <Text style={styles.sub}>ยังไม่มีข้อมูล</Text>
                ) : (
                  todayStats.topArr.map(([name, qty]) => (
                    <Text key={name} style={styles.orderLine}>
                      • {name} — {qty}
                    </Text>
                  ))
                )}
              </View>
            </View>
          </View>
        )}

        {/* Add Menu Modal (inline, no nested login modal) */}
        {addMenuOpen && (
          <View style={styles.overlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={styles.centerScroll} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>
                  <Text style={styles.title}>เพิ่มเมนู</Text>

                  <Text style={styles.label}>ชื่อ</Text>
                  <TextInput value={mName} onChangeText={setMName} style={styles.input} onFocus={onFocusAny} onBlur={onBlurAny} />

                  <Text style={styles.label}>คำอธิบาย</Text>
                  <TextInput
                    value={mDesc}
                    onChangeText={setMDesc}
                    style={[styles.input, { minHeight: 80, textAlignVertical: "top" } as any]}
                    multiline
                    onFocus={onFocusAny}
                    onBlur={onBlurAny}
                  />

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>หมวด</Text>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        {(["อาหาร", "ก๋วยเตี๋ยว", "เครื่องดื่ม"] as const).map((c) => (
                          <Chip key={c} label={c} active={mCategory === c} onPress={() => setMCategory(c)} />
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>ราคา</Text>
                      <TextInput
                        value={mPrice}
                        onChangeText={setMPrice}
                        keyboardType="numeric"
                        style={styles.input}
                        onFocus={onFocusAny}
                        onBlur={onBlurAny}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>สต็อก</Text>
                      <TextInput
                        value={mStock}
                        onChangeText={setMStock}
                        keyboardType="numeric"
                        style={styles.input}
                        onFocus={onFocusAny}
                        onBlur={onBlurAny}
                      />
                    </View>
                  </View>

                  <Text style={styles.label}>รูป (URL)</Text>
                  <TextInput
                    value={mImageUrl}
                    onChangeText={setMImageUrl}
                    style={styles.input}
                    onFocus={onFocusAny}
                    onBlur={onBlurAny}
                  />

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <PillButton label="ยกเลิก" tone="soft" onPress={() => setAddMenuOpen(false)} />
                    <View style={{ flex: 1 }} />
                    <PillButton label="บันทึก" tone="primary" onPress={addMenu} />
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // -------------------- CUSTOMER --------------------
  return (
    <SafeAreaView style={styles.root}>
      {Header}

      <View style={styles.tabRow}>
        <Chip label="เมนู" active={customerTab === "MENU"} onPress={() => setCustomerTab("MENU")} />
        <Chip label={`ตะกร้า (${cart.reduce((a, x) => a + x.qty, 0)})`} active={customerTab === "CART"} onPress={() => setCustomerTab("CART")} />
        <Chip label="สถานะ" active={customerTab === "STATUS"} onPress={() => setCustomerTab("STATUS")} />
        <View style={{ flex: 1 }} />
        <PillButton label="Reset" tone="soft" onPress={resetSession} />
      </View>

      {/* Table lock */}
      <View style={{ paddingHorizontal: 12 }}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>โต๊ะ</Text>
            <TextInput
              value={tableNo}
              onChangeText={setTableNo}
              placeholder="เช่น 5"
              style={styles.input}
              keyboardType="numeric"
              editable={!tableLocked}
              onFocus={onFocusAny}
              onBlur={onBlurAny}
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ justifyContent: "flex-end" }}>
            {tableLocked ? (
              <PillButton label="ล็อกแล้ว" tone="ok" disabled />
            ) : (
              <PillButton label="ล็อกโต๊ะ" tone="primary" onPress={lockTable} />
            )}
          </View>
        </View>
      </View>

      {customerTab === "MENU" && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 12, marginTop: 8 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ค้นหาเมนู..."
              style={[styles.input, { backgroundColor: THEME.card }]}
              onFocus={onFocusAny}
              onBlur={onBlurAny}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>

          {loadingMenu ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              data={filteredMenu}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View style={styles.menuCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuName}>{item.name}</Text>
                      {!!item.desc && <Text style={styles.menuDesc}>{item.desc}</Text>}
                      <Text style={styles.menuMeta}>
                        {normalizeCategory(item)} • ฿{thb(item.price)} • สต็อก {Number(item.stock || 0)}
                      </Text>
                    </View>
                    <PillButton
                      label={Number(item.stock || 0) > 0 ? "เลือก" : "หมด"}
                      tone={Number(item.stock || 0) > 0 ? "primary" : "soft"}
                      disabled={Number(item.stock || 0) <= 0}
                      onPress={() => openPicker(item)}
                    />
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ padding: 18 }}>
                  <Text style={styles.sub}>ไม่พบเมนูที่ค้นหา</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {customerTab === "CART" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={cart}
            keyExtractor={(it) => it.cart_key}
            contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <View style={styles.orderCard}>
                <Text style={styles.menuName}>{item.name}</Text>
                <Text style={styles.menuMeta}>
                  {item.protein ? `${item.protein}` : ""}
                  {item.noodle ? ` • ${item.noodle}` : ""}
                  {item.noodle_size ? ` • ${item.noodle_size}` : ""}
                  {item.note ? ` • ${item.note}` : ""}
                </Text>
                <Text style={styles.orderSub}>฿{thb(item.final_price)} / ชิ้น</Text>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
                  <PillButton label="-" tone="soft" onPress={() => updateQty(item.cart_key, -1)} />
                  <Text style={{ fontWeight: "900", color: THEME.text }}>x{item.qty}</Text>
                  <PillButton label="+" tone="soft" onPress={() => updateQty(item.cart_key, +1)} />
                  <View style={{ flex: 1 }} />
                  <PillButton label="ลบ" tone="danger" onPress={() => removeCart(item.cart_key)} />
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={{ padding: 18 }}>
                <Text style={styles.sub}>ตะกร้าว่าง</Text>
              </View>
            }
          />

          <View style={styles.bottomBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderSub}>รวม</Text>
              <Text style={styles.bigNumber}>฿{thb(cartTotal)}</Text>
            </View>
            <PillButton label="สั่งอาหาร" tone="primary" onPress={placeOrder} disabled={!tableLocked || cart.length === 0} />
          </View>
        </View>
      )}

      {customerTab === "STATUS" && (
        <View style={{ flex: 1 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>สถานะออเดอร์</Text>
            <PillButton label="รีเฟรช" tone="soft" onPress={() => loadOrders()} disabled={loadingOrders} />
          </View>

          {loadingOrders ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(it) => it.order_id}
              contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View style={styles.orderCard}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={styles.orderTitle}>โต๊ะ {item.table_no}</Text>
                    <View style={{ flex: 1 }} />
                    <Text
                      style={[
                        styles.badge,
                        item.status === "NEW"
                          ? { backgroundColor: THEME.warn }
                          : item.status === "ACCEPTED"
                          ? { backgroundColor: THEME.primary }
                          : item.status === "SERVED"
                          ? { backgroundColor: THEME.ok }
                          : { backgroundColor: THEME.danger },
                      ]}
                    >
                      {item.status === "CANCELLED" ? "ยกเลิกแล้ว" : item.status}
                    </Text>
                  </View>
                  <Text style={styles.orderSub}>รวม ฿{thb(item.total_price || 0)}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ padding: 18 }}>
                  <Text style={styles.sub}>ยังไม่มีออเดอร์ใน session นี้</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Picker Overlay */}
      {pickerOpen && pickedMenu && (
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.centerScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.card}>
                <Text style={styles.title}>{pickedMenu.name}</Text>
                <Text style={styles.sub}>เลือกตัวเลือก แล้วกดเพิ่มลงตะกร้า</Text>

                <Text style={styles.label}>โปรตีน</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {FOOD_PROTEIN.map((p) => (
                    <Chip
                      key={p.label}
                      label={p.add ? `${p.label} (+${p.add})` : p.label}
                      active={pickProtein.label === p.label}
                      onPress={() => setPickProtein(p)}
                    />
                  ))}
                </ScrollView>

                <Text style={styles.label}>เส้น</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {NOODLES.map((n) => (
                    <Chip key={n} label={n} active={pickNoodle === n} onPress={() => setPickNoodle(n)} />
                  ))}
                </ScrollView>

                <Text style={styles.label}>ขนาด</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {NOODLE_SIZES.map((s) => (
                    <Chip
                      key={s.label}
                      label={s.add ? `${s.label} (${s.add > 0 ? "+" : ""}${s.add})` : s.label}
                      active={pickNoodleSize.label === s.label}
                      onPress={() => setPickNoodleSize(s)}
                    />
                  ))}
                </ScrollView>

                <Text style={styles.label}>โน้ต (ถ้ามี)</Text>
                <TextInput
                  value={pickNote}
                  onChangeText={setPickNote}
                  placeholder="เช่น ไม่เผ็ด / ไม่ใส่ผัก / แพ้ถั่ว"
                  style={styles.input}
                  onFocus={onFocusAny}
                  onBlur={onBlurAny}
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <PillButton
                    label="ยกเลิก"
                    tone="soft"
                    onPress={() => {
                      setPickerOpen(false);
                      setPickedMenu(null);
                    }}
                  />
                  <View style={{ flex: 1 }} />
                  <PillButton label="เพิ่มลงตะกร้า" tone="primary" onPress={addToCart} />
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },

  header: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hTitle: { fontSize: 18, fontWeight: "900", color: THEME.text },
  hSub: { marginTop: 2, color: THEME.sub, fontWeight: "700" },

  tabRow: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.card,
    maxWidth: 180,
  },
  chipText: { fontWeight: "900" },
  chipScroll: { paddingHorizontal: 12, paddingBottom: 8, gap: 8, alignItems: "center" },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },

  title: { fontSize: 18, fontWeight: "900", color: THEME.text },
  sub: { marginTop: 4, color: THEME.sub, fontWeight: "700" },
  label: { marginTop: 10, marginBottom: 6, fontWeight: "900", color: THEME.text },
  input: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: THEME.text,
  },

  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "900" },

  bigBtn: {
    marginTop: 14,
    backgroundColor: THEME.primary2,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  bigBtnText: { fontWeight: "900", color: "#fff" },

  sectionHeader: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: THEME.text, flex: 1 },

  menuCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 10,
  },
  menuName: { fontSize: 16, fontWeight: "900", color: THEME.text },
  menuDesc: { marginTop: 4, color: THEME.sub, fontWeight: "700" },
  menuMeta: { marginTop: 6, color: THEME.sub, fontWeight: "800" },

  orderCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 10,
  },
  orderTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  orderSub: { marginTop: 4, color: THEME.sub, fontWeight: "800" },
  orderLine: { color: THEME.text, fontWeight: "700" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    color: "#fff",
    fontWeight: "900",
  },

  stockCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 10,
  },
  stockName: { fontSize: 16, fontWeight: "900", color: THEME.text },
  stockSub: { marginTop: 4, color: THEME.sub, fontWeight: "800" },
  stockQty: { fontSize: 22, fontWeight: "900", color: THEME.text },

  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: THEME.bg,
  },
  bigNumber: { fontSize: 20, fontWeight: "900", color: THEME.text },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
  },
  centerScroll: { flexGrow: 1, justifyContent: "center", padding: 16 },
});
