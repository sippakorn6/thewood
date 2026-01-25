import React, { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useApp } from "./_layout";
import { formatTHB } from "../lib/utils";
import type { OrderItemPayload } from "../lib/types";

const C = {
  bg: "#FFF8EE",
  card: "#FFF1E3",
  line: "rgba(139, 107, 79, 0.22)",
  text: "#2B1E14",
  sub: "rgba(43, 30, 20, 0.65)",
  primary: "#B88A5A",
  soft: "#F0E4D6",
  danger: "#C62828",
  ok: "#2E7D32",
};

export default function CartScreen() {
  const router = useRouter();
  const { tableNo, sessionId, cart, incCart, decCart, removeCart, clearCart } = useApp();
  const [placing, setPlacing] = useState(false);

  const total = useMemo(() => cart.reduce((s, x) => s + x.qty * x.unit_total_thb, 0), [cart]);

  const placeOrder = async () => {
    if (!tableNo) return router.replace("/");
    if (cart.length === 0) return Alert.alert("ตะกร้าว่าง", "กรุณาเพิ่มเมนูก่อน");
    setPlacing(true);
    try {
      const items: OrderItemPayload[] = cart.map((x) => ({
        menu_id: x.menu_id,
        name_th: x.name_th,
        qty: x.qty,
        base_price_thb: x.base_price_thb,
        options: x.options,
        note: x.note,
        extra_thb: x.extra_thb,
        unit_total_thb: x.unit_total_thb,
      }));

      const { data, error } = await supabase.rpc("place_order_atomic", {
        p_session_id: sessionId,
        p_table_no: tableNo,
        p_items: items,
        p_total_thb: total,
      });

      if (error) throw error;

      clearCart();
      Alert.alert("สั่งสำเร็จ", `ออเดอร์ #${data}`, [{ text: "ตกลง", onPress: () => router.replace("/menu") }]);
    } catch (e: any) {
      Alert.alert("สั่งไม่สำเร็จ", e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={s.page}>
      <View style={s.head}>
        <Text style={s.h1}>ตะกร้า</Text>
        <Pressable style={s.btn2} onPress={() => router.replace("/menu")}>
          <Text style={s.btn2Text}>กลับเมนู</Text>
        </Pressable>
      </View>

      <FlatList
        data={cart}
        keyExtractor={(x) => x.key}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.sub}>ยังไม่มีรายการในตะกร้า</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.name}>{item.name_th}</Text>
            <Text style={s.sub}>
              {Object.entries(item.options || {})
                .map(([k, v]) => `${k}: ${v}`)
                .join(" • ")}
              {item.note ? ` • โน้ต: ${item.note}` : ""}
            </Text>
            <View style={s.rowBetween}>
              <Text style={s.price}>{formatTHB(item.unit_total_thb)}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable style={s.qtyBtn} onPress={() => decCart(item.key)}>
                  <Text style={s.qtyBtnText}>-</Text>
                </Pressable>
                <View style={s.qtyBox}>
                  <Text style={s.qtyText}>{item.qty}</Text>
                </View>
                <Pressable style={s.qtyBtn} onPress={() => incCart(item.key)}>
                  <Text style={s.qtyBtnText}>+</Text>
                </Pressable>
                <Pressable style={s.delBtn} onPress={() => removeCart(item.key)}>
                  <Text style={s.delBtnText}>ลบ</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      <View style={s.footer}>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>รวม</Text>
          <Text style={s.total}>{formatTHB(total)}</Text>
        </View>

        <Pressable style={[s.btn, placing && { opacity: 0.7 }]} onPress={placeOrder} disabled={placing}>
          {placing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>สั่งอาหาร</Text>}
        </Pressable>

        <Pressable style={s.clearBtn} onPress={() => clearCart()}>
          <Text style={s.clearBtnText}>เคลียร์ตะกร้า</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, padding: 12, backgroundColor: C.bg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  h1: { fontSize: 20, fontWeight: "900", color: C.text },
  btn2: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line },
  btn2Text: { color: C.text, fontWeight: "900" },
  empty: { padding: 20, alignItems: "center" },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 10 },
  name: { color: C.text, fontWeight: "900", fontSize: 16 },
  sub: { color: C.sub, marginTop: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  price: { color: C.text, fontWeight: "900" },
  qtyBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { color: C.text, fontWeight: "900", fontSize: 18 },
  qtyBox: { width: 40, height: 34, borderRadius: 10, backgroundColor: "#FFFDF9", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  qtyText: { color: C.text, fontWeight: "900" },
  delBtn: { paddingHorizontal: 10, height: 34, borderRadius: 10, backgroundColor: "#F3D1C9", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  delBtnText: { color: C.danger, fontWeight: "900" },

  footer: { position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: "#FFF8EE", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: C.line },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  totalLabel: { color: C.text, fontWeight: "900" },
  total: { color: C.text, fontWeight: "900" },
  btn: { backgroundColor: C.primary, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  clearBtn: { marginTop: 10, backgroundColor: C.soft, paddingVertical: 12, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: C.line },
  clearBtnText: { color: C.text, fontWeight: "900" },
});
