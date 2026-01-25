  const fmtOptions = (options: any) => {
    if (!options || typeof options !== "object") return "";
    const parts = Object.entries(options)
      .filter(([_, v]) => String(v ?? "").trim().length > 0)
      .map(([k, v]) => `${k}: ${v}`);
    return parts.length ? ` • ${parts.join(", ")}` : "";
  };
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useApp } from "./_layout";
import type { OrderRow } from "../lib/types";
import { stableStringify, formatTHB } from "../lib/utils";

const C = {
  bg: "#FFF8EE",
  card: "#FFF1E3",
  line: "rgba(139, 107, 79, 0.22)",
  text: "#2B1E14",
  sub: "rgba(43, 30, 20, 0.65)",
  primary: "#B88A5A",
  soft: "#F0E4D6",
};

const ORDER_COLS = "id,session_id,table_no,status,items,total_thb,created_at,updated_at";

export default function OrdersScreen() {
  const router = useRouter();
  const { tableNo, sessionId, isTyping } = useApp();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"ACTIVE" | "HISTORY">("ACTIVE");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const sigRef = useRef("");

  useEffect(() => {
    if (!tableNo) router.replace("/");
  }, [tableNo]);

  const load = async () => {
    if (isTyping) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_COLS)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return Alert.alert("โหลดออเดอร์ไม่สำเร็จ", error.message);
    const sig = stableStringify(data || []);
    if (sig !== sigRef.current) {
      sigRef.current = sig;
      setOrders((data as any[]) || []);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [sessionId, isTyping, view]);

  return (
    <View style={s.page}>
      <View style={s.head}>
        <Text style={s.h1}>สถานะออเดอร์</Text>

        <View style={s.tabs}>
          <Pressable style={[s.tab, view === "ACTIVE" && s.tabActive]} onPress={() => setView("ACTIVE")}>
            <Text style={[s.tabText, view === "ACTIVE" && s.tabTextActive]}>กำลังทำ</Text>
          </Pressable>
          <Pressable style={[s.tab, view === "HISTORY" && s.tabActive]} onPress={() => setView("HISTORY")}>
            <Text style={[s.tabText, view === "HISTORY" && s.tabTextActive]}>ประวัติ</Text>
          </Pressable>
        </View>

        <Pressable style={s.btn2} onPress={() => router.replace("/menu")}>
          <Text style={s.btn2Text}>กลับเมนู</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.sub}>กำลังโหลด...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(x) => String(x.id)}
          ListEmptyComponent={<View style={s.center}><Text style={s.sub}>ยังไม่มีออเดอร์</Text></View>}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.title}>#{item.id}</Text>
                <Text style={s.badge}>{item.status}</Text>
              </View>
              <Text style={s.sub}>รวม {formatTHB(Number(item.total_thb || 0))}</Text>

              <View style={s.itemsBox}>
                {(Array.isArray(item.items) ? item.items : []).slice(0, 50).map((it: any, i: number) => {
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
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, padding: 12, backgroundColor: C.bg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  h1: { color: C.text, fontSize: 18, fontWeight: "900" },
  btn2: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line },
  btn2Text: { color: C.text, fontWeight: "900" },
  center: { padding: 20, alignItems: "center" },
  sub: { color: C.sub, marginTop: 6 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: C.text, fontWeight: "900", fontSize: 16 },
  badge: { color: "#fff", backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  tabs: { flexDirection: "row", gap: 8, marginTop: 10 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.soft },
  tabActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { color: C.text, fontWeight: "700" },
  tabTextActive: { color: "#fff" },

});