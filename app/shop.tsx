import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, Alert, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useApp } from "./_layout";
import type { MenuItem, OrderRow } from "../lib/types";
import { formatTHB, stableStringify } from "../lib/utils";

const C = {
  bg: "#FFF8EE",
  card: "#FFF1E3",
  line: "rgba(139, 107, 79, 0.22)",
  text: "#2B1E14",
  sub: "rgba(43, 30, 20, 0.65)",
  primary: "#B88A5A",
  soft: "#F0E4D6",
  ok: "#2E7D32",
  danger: "#C62828",
};

const MENU_COLS = 'id,name_th,category,price_thb,stock,description,image_url,is_active,created_at';
const ORDER_COLS = "id,session_id,table_no,status,items,total_thb,created_at,updated_at";

function usePolling(fn: () => void, enabled: boolean, ms: number) {
  useEffect(() => {
    if (!enabled) return;
    fn();
    const t = setInterval(fn, ms);
    return () => clearInterval(t);
  }, [enabled, ms]);
}

export default function Shop() {
  const router = useRouter();
  const { shopLoggedIn, setShopLoggedIn, setMode, isTyping, setIsTyping } = useApp();

  const [tab, setTab] = useState<"ORDERS" | "MENU">("ORDERS");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersView, setOrdersView] = useState<"ACTIVE" | "HISTORY">("ACTIVE");
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);

  const orderSig = useRef("");
  const menuSig = useRef("");

  const [mName, setMName] = useState("");
  const [mCat, setMCat] = useState("อาหาร");
  const [mPrice, setMPrice] = useState("0");
  const [mStock, setMStock] = useState("0");
  const [mDesc, setMDesc] = useState("");
  const [mImageUrl, setMImageUrl] = useState("");

  // HARD GUARD: never render SHOP_APP even 1 frame if not logged in
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      const ok = !!data.session;
      if (!ok) {
        setShopLoggedIn(false);
        setMode("SHOP_LOGIN");
        router.replace("/shop-login");
        return;
      }
      setShopLoggedIn(true);
      setMode("SHOP_APP");
    };
    run();
  }, []);

  const loadOrders = async () => {
    if (isTyping) return;
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_COLS)
      .in("status", ordersView === "ACTIVE" ? ["NEW", "ACCEPTED"] : ["SERVED", "CANCELLED"])
      .order("created_at", { ascending: false });
    setLoadingOrders(false);
    if (error) return;
    const sig = stableStringify(data || []);
    if (sig !== orderSig.current) {
      orderSig.current = sig;
      setOrders((data as any[]) || []);
    }
  };

  const loadMenu = async () => {
    if (isTyping) return;
    setLoadingMenu(true);
    const { data, error } = await supabase.from("menu_items").select(MENU_COLS).order("created_at", { ascending: false });
    setLoadingMenu(false);
    if (error) return;
    const sig = stableStringify(data || []);
    if (sig !== menuSig.current) {
      menuSig.current = sig;
      setMenu((data as any[]) || []);
    }
  };

  usePolling(loadOrders, shopLoggedIn && !isTyping && tab === "ORDERS", 4000);
  usePolling(loadMenu, shopLoggedIn && !isTyping && tab === "MENU", 5000);

  if (!shopLoggedIn) return null;

  const logout = async () => {
    await supabase.auth.signOut();
    setShopLoggedIn(false);
    setMode("CUSTOMER");
    router.replace("/");
  };

  const acceptOrder = async (id: number) => {
    const { error } = await supabase.from("orders").update({ status: "ACCEPTED" }).eq("id", id);
    if (error) return Alert.alert("รับออเดอร์ไม่สำเร็จ", error.message);
    loadOrders();
  };

  const serveOrder = async (id: number) => {
    const { error } = await supabase.from("orders").update({ status: "SERVED" }).eq("id", id);
    if (error) return Alert.alert("เสิร์ฟไม่สำเร็จ", error.message);
    try {
      await supabase.from("served_history").insert([{ order_id: id }]);
    } catch {}
loadOrders();
  };

  const softDeleteMenu = async (id: number) => {
    const { error } = await supabase.from("menu_items").update({ is_active: false }).eq("id", id);
    if (error) return Alert.alert("ลบไม่สำเร็จ", error.message);
    loadMenu();
  };

  const toggleActive = async (id: number, is_active: boolean) => {
    const { error } = await supabase.from("menu_items").update({ is_active: !is_active }).eq("id", id);
    if (error) return Alert.alert("เปลี่ยนสถานะไม่สำเร็จ", error.message);
    loadMenu();
  };

  const updateStock = async (id: number, next: number) => {
    const { error } = await supabase.from("menu_items").update({ stock: Math.max(0, next) }).eq("id", id);
    if (error) return Alert.alert("อัปเดตสต็อกไม่สำเร็จ", error.message);
    loadMenu();
  };

  const addMenu = async () => {
    const priceNum = Number(mPrice);
    const stockNum = Number(mStock);
    if (!mName.trim()) return Alert.alert("เพิ่มเมนู", "กรอกชื่อเมนู");
    const payload = {
      name_th: mName.trim(),
      category: (mCat || "อาหาร").trim(),
      price_thb: Number.isFinite(priceNum) ? priceNum : 0,
      stock: Number.isFinite(stockNum) ? stockNum : 0,
      description: (mDesc || "").trim(),
      image_url: (mImageUrl || "").trim() || null,
      is_active: true,
    };
    const { error } = await supabase.from("menu_items").insert([payload]);
    if (error) return Alert.alert("เพิ่มเมนูไม่สำเร็จ", error.message);
    setMName(""); setMCat("อาหาร"); setMPrice("0"); setMStock("0"); setMDesc(""); setMImageUrl("");
    loadMenu();
  };

  return (
    <View style={s.page}>
      <View style={s.head}>
        <Text style={s.h1}>SHOP</Text>
        <Pressable style={s.logout} onPress={logout}>
          <Text style={s.logoutText}>ออกจากระบบ</Text>
        </Pressable>
      </View>

      <View style={s.tabRow}>
        <Pressable style={[s.tab, tab === "ORDERS" && s.tabOn]} onPress={() => setTab("ORDERS")}>
          <Text style={[s.tabText, tab === "ORDERS" && s.tabTextOn]}>ออเดอร์</Text>
        </Pressable>
        <Pressable style={[s.tab, tab === "MENU" && s.tabOn]} onPress={() => setTab("MENU")}>
          <Text style={[s.tabText, tab === "MENU" && s.tabTextOn]}>เมนู/สต็อก</Text>
        </Pressable>
      </View>

      {tab === "ORDERS" ? (
        <View style={{ flex: 1 }}>
          <View style={s.orderHead}>
            <View style={s.tabs}>
              <Pressable style={[s.tab2, ordersView === "ACTIVE" && s.tab2On]} onPress={() => setOrdersView("ACTIVE")}>
                <Text style={[s.tab2Text, ordersView === "ACTIVE" && s.tab2TextOn]}>กำลังทำ</Text>
              </Pressable>
              <Pressable style={[s.tab2, ordersView === "HISTORY" && s.tab2On]} onPress={() => setOrdersView("HISTORY")}>
                <Text style={[s.tab2Text, ordersView === "HISTORY" && s.tab2TextOn]}>ประวัติ</Text>
              </Pressable>
            </View>
            <Text style={s.sub}>
              {ordersView === "ACTIVE" ? "แสดง: NEW / ACCEPTED" : "แสดง: SERVED / CANCELLED"}
            </Text>
          </View>

          <FlatList
          data={orders}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={<View style={{ padding: 20, alignItems: "center" }}><Text style={s.sub}>ยังไม่มีออเดอร์</Text></View>}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>โต๊ะ {item.table_no} • #{item.id}</Text>
                <Text style={s.badge}>{item.status}</Text>
              </View>
              <Text style={s.sub}>รวม {formatTHB(Number(item.total_thb || 0))}</Text>

              <View style={s.itemsBox}>
                {(Array.isArray(item.items) ? item.items : []).slice(0, 80).map((it: any, i: number) => {
                  const qty = Number(it?.qty || 0);
                  const name = String(it?.name_th || "");
                  const note = String(it?.note || "").trim();
                  const opt = fmtOptions(it?.options);
                  const unit = Number(it?.unit_total_thb || 0);
                  const lineTotal = qty * unit;
                  return (
                    <View key={i} style={s.itemRow}>
                      <Text style={s.itemText}>
                        {qty}× {name}
                        {opt}
                        {note ? ` • หมายเหตุ: ${note}` : ""}
                      </Text>
                      <Text style={s.itemPrice}>{formatTHB(lineTotal)}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                {item.status === "NEW" ? (
                  <Pressable style={s.btnOk} onPress={() => acceptOrder(item.id)}>
                    <Text style={s.btnOkText}>รับออเดอร์</Text>
                  </Pressable>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <Pressable style={s.btn} onPress={() => serveOrder(item.id)}>
                  <Text style={s.btnText}>เสิร์ฟแล้ว</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          <View style={s.card}>
            <Text style={s.cardTitle}>เพิ่มเมนู</Text>
            <TextInput value={mName} onChangeText={setMName} placeholder="ชื่อเมนู" placeholderTextColor="rgba(43,30,20,0.35)" style={s.input} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} />
            <TextInput value={mCat} onChangeText={setMCat} placeholder="หมวด (อาหาร/ก๋วยเตี๋ยว/เครื่องดื่ม)" placeholderTextColor="rgba(43,30,20,0.35)" style={s.input} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput value={mPrice} onChangeText={setMPrice} placeholder="ราคา" placeholderTextColor="rgba(43,30,20,0.35)" style={[s.input, { flex: 1 }]} keyboardType="numeric" onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} />
              <TextInput value={mStock} onChangeText={setMStock} placeholder="สต็อก" placeholderTextColor="rgba(43,30,20,0.35)" style={[s.input, { flex: 1 }]} keyboardType="numeric" onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} />
            </View>
            <TextInput value={mImageUrl} onChangeText={setMImageUrl} placeholder="image_url (ลิงก์รูป)" placeholderTextColor="rgba(43,30,20,0.35)" style={s.input} autoCapitalize="none" onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} />
            <TextInput value={mDesc} onChangeText={setMDesc} placeholder="คำอธิบาย" placeholderTextColor="rgba(43,30,20,0.35)" style={[s.input, { height: 90, textAlignVertical: "top" }]} multiline onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} />
            <Pressable style={s.btn} onPress={addMenu}>
              <Text style={s.btnText}>เพิ่มเมนู</Text>
            </Pressable>
          </View>

          {loadingMenu ? (
            <View style={{ padding: 20, alignItems: "center" }}><ActivityIndicator /><Text style={s.sub}>กำลังโหลด...</Text></View>
          ) : null}

          {menu.map((m) => (
            <View key={m.id} style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{m.name_th}</Text>
                <Text style={s.sub}>{m.is_active ? "ACTIVE" : "INACTIVE"}</Text>
              </View>
              <Text style={s.sub}>{m.category} • {formatTHB(Number(m.price_thb || 0))}</Text>
              <View style={s.rowBetween}>
                <Text style={s.sub}>สต็อก {m.stock ?? 0}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.small} onPress={() => updateStock(m.id, (m.stock ?? 0) - 1)}><Text style={s.smallText}>-</Text></Pressable>
                  <Pressable style={s.small} onPress={() => updateStock(m.id, (m.stock ?? 0) + 1)}><Text style={s.smallText}>+</Text></Pressable>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Pressable style={s.btn2} onPress={() => toggleActive(m.id, m.is_active)}>
                  <Text style={s.btn2Text}>{m.is_active ? "ปิดขาย" : "เปิดขาย"}</Text>
                </Pressable>
                <Pressable style={s.btnDanger} onPress={() => softDeleteMenu(m.id)}>
                  <Text style={s.btnDangerText}>ลบ (ซ่อนลูกค้า)</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, padding: 12, backgroundColor: C.bg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  h1: { color: C.text, fontSize: 18, fontWeight: "900" },
  logout: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#EAD7C2", borderWidth: 1, borderColor: C.line },
  logoutText: { color: C.text, fontWeight: "900" },
  tabRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  tabOn: { backgroundColor: C.primary },
  tabText: { color: C.text, fontWeight: "900" },
  tabTextOn: { color: "#fff" },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 10 },
  cardTitle: { color: C.text, fontWeight: "900", fontSize: 16 },
  sub: { color: C.sub, marginTop: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { color: "#fff", backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },

  btn: { flex: 1, backgroundColor: C.primary, paddingVertical: 11, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "900" },
  btn2: { flex: 1, backgroundColor: C.soft, paddingVertical: 11, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: C.line },
  btn2Text: { color: C.text, fontWeight: "900" },
  btnOk: { flex: 1, backgroundColor: "#2E7D32", paddingVertical: 11, borderRadius: 14, alignItems: "center" },
  btnOkText: { color: "#fff", fontWeight: "900" },
  btnDanger: { flex: 1, backgroundColor: "#F3D1C9", paddingVertical: 11, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: C.line },
  btnDangerText: { color: C.danger, fontWeight: "900" },

  input: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: C.text, backgroundColor: "#FFFDF9", marginTop: 10 },
  small: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  smallText: { color: C.text, fontWeight: "900", fontSize: 18 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 6 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.soft },
  tabActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { color: C.text, fontWeight: "700" },
  tabTextActive: { color: "#fff" },

});
