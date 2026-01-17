import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error(
      "Missing Supabase env. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON);
}
const supabase = getSupabase();

// ---- The Wood theme ----
const COLORS = {
  bg: "#F7F1E6",
  card: "#FFF8EE",
  woodDark: "#8B6B4F",
  text: "#2B1E14",
  muted: "#6B4E3B",
  border: "#E6D6C3",
  white: "#FFFFFF",
  danger: "#B5473A",
  ok: "#2E7D32",
};
const UI = { pad: 16, radius: 16 };

const S = {
  page: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    paddingHorizontal: UI.pad,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  brandRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.card },
  brandText: { fontSize: 18, fontWeight: "900" as const, color: COLORS.text },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  h1: { fontSize: 18, fontWeight: "900" as const, color: COLORS.text },
  p: { color: COLORS.muted },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 12,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  btnPrimary: {
    backgroundColor: COLORS.woodDark,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center" as const,
  },
  btnPrimaryText: { color: COLORS.white, fontWeight: "900" as const },
  btnGhost: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center" as const,
    backgroundColor: COLORS.white,
  },
  btnGhostText: { color: COLORS.text, fontWeight: "800" as const },
  dangerBtn: { backgroundColor: COLORS.danger, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  dangerText: { color: COLORS.white, fontWeight: "900" as const },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.woodDark, borderColor: COLORS.woodDark },
  chipText: { color: COLORS.text, fontWeight: "800" as const },
  chipTextActive: { color: COLORS.white },
};

type MenuItem = {
  id: string;
  name: string;
  desc?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
  is_active?: boolean | null;
  created_at_ms?: number | null;
};

type CartLine = {
  id: string;
  name: string;
  qty: number;
  price_total: number;
};

function stableStringify(v: any) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

function dayStartMs(nowMs: number) {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function ShopScreen() {
  const [shopLoggedIn, setShopLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isTypingRef = useRef(false);
  const setTyping = (v: boolean) => { isTypingRef.current = v; };

  const [tab, setTab] = useState<"ORDERS" | "MENU" | "STATS">("ORDERS");

  const [orders, setOrders] = useState<any[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);

  const lastOrdersSig = useRef("");
  const lastMenuSig = useRef("");

  // Add menu form
  const [addOpen, setAddOpen] = useState(false);
  const [mName, setMName] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mCat, setMCat] = useState("อาหาร");
  const [mPrice, setMPrice] = useState("0");
  const [mStock, setMStock] = useState("0");
  const [mImage, setMImage] = useState("");

  // Stats
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [topMenu, setTopMenu] = useState<{ name: string; qty: number }[]>([]);

  const Logo = () => (
    <Image source={require("../../assets/logo.jpeg")} style={S.logo as any} resizeMode="cover" />
  );

  const TopBar = () => (
    <View style={S.topBar as any}>
      <View style={S.brandRow as any}>
        <Logo />
        <Text style={S.brandText as any}>The Wood</Text>
      </View>
      {shopLoggedIn ? (
        <Pressable style={S.btnGhost as any} onPress={onLogout}>
          <Text style={S.btnGhostText as any}>Logout</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at_ms", { ascending: false });
    if (error) return;
    const sig = stableStringify(data ?? []);
    if (sig !== lastOrdersSig.current) {
      lastOrdersSig.current = sig;
      setOrders(data ?? []);
    }
  };

  const loadMenu = async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("created_at_ms", { ascending: false });
    if (error) return;
    const sig = stableStringify(data ?? []);
    if (sig !== lastMenuSig.current) {
      lastMenuSig.current = sig;
      setMenu((data ?? []) as any);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadOrders(), loadMenu(), loadStatsToday()]);
  };

  // Polling (diff-check) only when logged in, tab orders, and not typing
  const pollTimer = useRef<any>(null);
  const schedulePoll = () => {
    clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(async () => {
      if (!shopLoggedIn || tab !== "ORDERS" || isTypingRef.current) {
        schedulePoll();
        return;
      }
      await loadOrders();
      schedulePoll();
    }, 2500);
  };

  useEffect(() => {
    if (shopLoggedIn) {
      refreshAll();
      schedulePoll();
    }
    return () => clearTimeout(pollTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopLoggedIn, tab]);

  const onLogin = async () => {
    setTyping(false);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return Alert.alert("Login ไม่สำเร็จ", error.message);
    setShopLoggedIn(true);
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    setShopLoggedIn(false);
    setOrders([]);
    setMenu([]);
    setTab("ORDERS");
  };

  const updateStatus = async (order: any, nextStatus: "ACCEPTED" | "SERVED") => {
    const patch: any = { status: nextStatus };
    if (nextStatus === "ACCEPTED") patch.accepted_at_ms = Date.now();
    if (nextStatus === "SERVED") patch.served_at_ms = Date.now();

    const { error } = await supabase.from("orders").update(patch).eq("order_id", order.order_id);
    if (error) return Alert.alert("อัปเดตไม่สำเร็จ", error.message);

    if (nextStatus === "SERVED") {
      // Write served_history (best-effort)
      const payload: any = {
        order_id: order.order_id,
        table_no: order.table_no,
        served_at_ms: Date.now(),
        total_price: order.total_price ?? null,
        items_json: order.items_json ?? null,
      };
      await supabase.from("served_history").insert(payload);
    }

    await Promise.all([loadOrders(), loadStatsToday()]);
  };

  const cancelOrder = async (order: any) => {
    if (!["NEW", "ACCEPTED"].includes(order.status)) return;

    let items: CartLine[] = [];
    try {
      items = JSON.parse(order.items_json ?? "[]");
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    const { error: upErr } = await supabase
      .from("orders")
      .update({ status: "CANCELLED", cancelled_at_ms: Date.now() })
      .eq("order_id", order.order_id);

    if (upErr) return Alert.alert("ยกเลิกไม่สำเร็จ", upErr.message);

    // คืนสต็อก
    for (const line of items) {
      const qty = Number(line.qty ?? 1);
      const { data: mi } = await supabase.from("menu_items").select("stock").eq("id", line.id).single();
      const stock = Number((mi as any)?.stock ?? 0);
      await supabase.from("menu_items").update({ stock: stock + qty }).eq("id", line.id);
    }

    await loadOrders();
  };

  const adjustStock = async (item: MenuItem, delta: number) => {
    const next = Math.max(0, Number(item.stock ?? 0) + delta);
    const { error } = await supabase.from("menu_items").update({ stock: next }).eq("id", item.id);
    if (error) Alert.alert("อัปเดตสต็อกไม่สำเร็จ", error.message);
    await loadMenu();
  };

  const setOutOfStock = async (item: MenuItem) => {
    const { error } = await supabase.from("menu_items").update({ stock: 0 }).eq("id", item.id);
    if (error) Alert.alert("อัปเดตสต็อกไม่สำเร็จ", error.message);
    await loadMenu();
  };

  const softDeleteMenu = async (item: MenuItem) => {
    Alert.alert(
      "ลบเมนู",
      `ต้องการซ่อนเมนู "${item.name}" ใช่ไหม?\n(ลูกค้าจะไม่เห็นเมนูนี้ทันที)`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบ",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("menu_items").update({ is_active: false }).eq("id", item.id);
            if (error) Alert.alert("ลบไม่สำเร็จ", error.message);
            await loadMenu();
          },
        },
      ]
    );
  };

  const addMenu = async () => {
    const name = mName.trim();
    const category = mCat.trim();
    const price = Number(mPrice || 0);
    const stock = Number(mStock || 0);
    const image_url = mImage.trim() || null;
    const desc = mDesc.trim() || null;

    if (!name) return Alert.alert("กรุณาใส่ชื่อเมนู");
    if (!category) return Alert.alert("กรุณาใส่หมวดหมู่");
    if (!Number.isFinite(price) || price < 0) return Alert.alert("ราคาไม่ถูกต้อง");
    if (!Number.isFinite(stock) || stock < 0) return Alert.alert("สต็อกไม่ถูกต้อง");

    const payload: any = {
      name,
      category,
      price,
      stock,
      image_url,
      desc,
      is_active: true,
      created_at_ms: Date.now(),
    };

    const { error } = await supabase.from("menu_items").insert(payload);
    if (error) return Alert.alert("เพิ่มเมนูไม่สำเร็จ", error.message);

    setAddOpen(false);
    setMName("");
    setMDesc("");
    setMCat("อาหาร");
    setMPrice("0");
    setMStock("0");
    setMImage("");
    await loadMenu();
  };

  const loadStatsToday = async () => {
    // Stats from served_history (today)
    const start = dayStartMs(Date.now());

    const { data, error } = await supabase
      .from("served_history")
      .select("*")
      .gte("served_at_ms", start)
      .order("served_at_ms", { ascending: false });

    if (error) return;

    const rows = data ?? [];
    let total = 0;
    let count = 0;
    const map: Record<string, number> = {};

    for (const r of rows as any[]) {
      count += 1;
      const tp = Number(r.total_price ?? 0);
      if (Number.isFinite(tp)) total += tp;

      // Top menu by items_json
      try {
        const items = JSON.parse(r.items_json ?? "[]");
        if (Array.isArray(items)) {
          for (const it of items) {
            const name = String(it.name ?? "").trim();
            const qty = Number(it.qty ?? 0);
            if (!name || !Number.isFinite(qty)) continue;
            map[name] = (map[name] ?? 0) + qty;
          }
        }
      } catch {}
    }

    const top = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, qty]) => ({ name, qty }));

    setTodayTotal(total);
    setTodayCount(count);
    setTopMenu(top);
  };

  const menuActive = useMemo(() => menu.filter((m) => m.is_active !== false), [menu]);

  return (
    <View style={S.page as any}>
      <TopBar />

      {!shopLoggedIn ? (
        <ScrollView contentContainerStyle={{ padding: UI.pad, gap: 12 }}>
          <View style={[S.card as any, { gap: 10 }]}>
            <Text style={S.h1 as any}>เข้าสู่ระบบร้านค้า</Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              autoCapitalize="none"
              style={S.input as any}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              style={S.input as any}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
            />

            <Pressable style={S.btnPrimary as any} onPress={onLogin}>
              <Text style={S.btnPrimaryText as any}>Login</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: UI.pad, gap: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[
              { k: "ORDERS", t: "ออเดอร์" },
              { k: "MENU", t: "สต็อก/เมนู" },
              { k: "STATS", t: "สถิติวันนี้" },
            ].map((x) => {
              const active = tab === (x.k as any);
              return (
                <Pressable
                  key={x.k}
                  onPress={() => setTab(x.k as any)}
                  style={[S.chip as any, active ? (S.chipActive as any) : null]}
                >
                  <Text style={[S.chipText as any, active ? (S.chipTextActive as any) : null]}>
                    {x.t}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {tab === "ORDERS" && (
            <View style={{ gap: 10 }}>
              <Pressable style={S.btnGhost as any} onPress={loadOrders}>
                <Text style={S.btnGhostText as any}>รีเฟรชออเดอร์</Text>
              </Pressable>

              {orders.length === 0 ? (
                <View style={S.card as any}>
                  <Text style={S.p as any}>ยังไม่มีออเดอร์</Text>
                </View>
              ) : (
                orders.map((o) => (
                  <View key={o.order_id} style={[S.card as any, { gap: 8 }]}>
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      โต๊ะ {o.table_no} • {o.status}
                    </Text>
                    <Text style={{ color: COLORS.muted, fontSize: 12 }}>Order: {o.order_id}</Text>
                    <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                      รวม ฿{Number(o.total_price ?? 0).toFixed(0)}
                    </Text>

                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" as const }}>
                      {o.status === "NEW" && (
                        <Pressable style={S.btnPrimary as any} onPress={() => updateStatus(o, "ACCEPTED")}>
                          <Text style={S.btnPrimaryText as any}>รับออเดอร์</Text>
                        </Pressable>
                      )}
                      {o.status === "ACCEPTED" && (
                        <Pressable style={S.btnPrimary as any} onPress={() => updateStatus(o, "SERVED")}>
                          <Text style={S.btnPrimaryText as any}>เสิร์ฟแล้ว</Text>
                        </Pressable>
                      )}
                      {["NEW", "ACCEPTED"].includes(o.status) && (
                        <Pressable style={S.dangerBtn as any} onPress={() => cancelOrder(o)}>
                          <Text style={S.dangerText as any}>ยกเลิก + คืนสต็อก</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {tab === "MENU" && (
            <View style={{ gap: 10 }}>
              <View style={[S.card as any, { gap: 10 }]}>
                <Text style={S.h1 as any}>จัดการเมนู</Text>
                <Pressable style={S.btnPrimary as any} onPress={() => setAddOpen((v) => !v)}>
                  <Text style={S.btnPrimaryText as any}>{addOpen ? "ปิดฟอร์มเพิ่มเมนู" : "➕ เพิ่มเมนู"}</Text>
                </Pressable>

                {addOpen && (
                  <View style={{ gap: 8 }}>
                    <TextInput value={mName} onChangeText={setMName} placeholder="ชื่อเมนู" style={S.input as any} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} />
                    <TextInput value={mDesc} onChangeText={setMDesc} placeholder="รายละเอียด (ไม่ใส่ก็ได้)" style={S.input as any} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} />
                    <TextInput value={mCat} onChangeText={setMCat} placeholder="หมวด (อาหาร/ก๋วยเตี๋ยว/เครื่องดื่ม)" style={S.input as any} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} />
                    <TextInput value={mPrice} onChangeText={setMPrice} placeholder="ราคา" keyboardType="number-pad" style={S.input as any} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} />
                    <TextInput value={mStock} onChangeText={setMStock} placeholder="สต็อก" keyboardType="number-pad" style={S.input as any} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} />
                    <TextInput value={mImage} onChangeText={setMImage} placeholder="image_url (ไม่ใส่ก็ได้)" style={S.input as any} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} />
                    <Pressable style={S.btnPrimary as any} onPress={addMenu}>
                      <Text style={S.btnPrimaryText as any}>บันทึกเมนู</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <Pressable style={S.btnGhost as any} onPress={loadMenu}>
                <Text style={S.btnGhostText as any}>รีเฟรชเมนู</Text>
              </Pressable>

              {menuActive.map((m) => (
                <View key={m.id} style={[S.card as any, { gap: 8 }]}>
                  <Text style={{ fontWeight: "900", color: COLORS.text }}>{m.name}</Text>
                  <Text style={{ color: COLORS.muted }}>หมวด: {m.category} • ฿{Number(m.price ?? 0).toFixed(0)}</Text>
                  <Text style={{ color: COLORS.text, fontWeight: "800" }}>stock: {Number(m.stock ?? 0)}</Text>

                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" as const }}>
                    <Pressable style={S.btnGhost as any} onPress={() => adjustStock(m, -1)}>
                      <Text style={S.btnGhostText as any}>-</Text>
                    </Pressable>
                    <Pressable style={S.btnGhost as any} onPress={() => adjustStock(m, +1)}>
                      <Text style={S.btnGhostText as any}>+</Text>
                    </Pressable>
                    <Pressable style={S.btnGhost as any} onPress={() => setOutOfStock(m)}>
                      <Text style={S.btnGhostText as any}>หมด</Text>
                    </Pressable>
                    <Pressable style={S.dangerBtn as any} onPress={() => softDeleteMenu(m)}>
                      <Text style={S.dangerText as any}>ลบเมนู</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {tab === "STATS" && (
            <View style={{ gap: 10 }}>
              <Pressable style={S.btnGhost as any} onPress={loadStatsToday}>
                <Text style={S.btnGhostText as any}>รีเฟรชสถิติ</Text>
              </Pressable>

              <View style={[S.card as any, { gap: 6 }]}>
                <Text style={S.h1 as any}>วันนี้</Text>
                <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 22 }}>
                  ฿{Number(todayTotal).toFixed(0)}
                </Text>
                <Text style={S.p as any}>จำนวนบิล: {todayCount}</Text>
              </View>

              <View style={[S.card as any, { gap: 8 }]}>
                <Text style={S.h1 as any}>Top เมนูวันนี้</Text>
                {topMenu.length === 0 ? (
                  <Text style={S.p as any}>ยังไม่มีข้อมูล (ต้องกด “เสิร์ฟแล้ว” เพื่อบันทึก served_history)</Text>
                ) : (
                  topMenu.map((x) => (
                    <View key={x.name} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: COLORS.text, fontWeight: "800" }}>{x.name}</Text>
                      <Text style={{ color: COLORS.muted }}>× {x.qty}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
