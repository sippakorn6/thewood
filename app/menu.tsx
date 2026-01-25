import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Image, Modal, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import type { MenuItem } from "../lib/types";
import { useApp } from "./_layout";
import { getOptionGroups, calcExtra } from "../lib/options";
import { formatTHB, stableStringify } from "../lib/utils";

const C = {
  bg: "#FFF8EE",
  card: "#FFF1E3",
  line: "rgba(139, 107, 79, 0.22)",
  text: "#2B1E14",
  sub: "rgba(43, 30, 20, 0.65)",
  primary: "#B88A5A",
  soft: "#F0E4D6",
  danger: "#C62828",
};

const MENU_COLS = 'id,name_th,category,price_thb,stock,description,image_url,is_active,created_at';
const CATS = ["ทั้งหมด", "อาหาร", "ก๋วยเตี๋ยว", "เครื่องดื่ม"];

export default function MenuScreen() {
  const router = useRouter();
  const { tableNo, sessionId, cart, addToCart, setIsTyping, isTyping } = useApp();

  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cat, setCat] = useState("ทั้งหมด");
  const [q, setQ] = useState("");

  const [customOpen, setCustomOpen] = useState(false);
  const [picked, setPicked] = useState<MenuItem | null>(null);
  const [options, setOptions] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const menuSigRef = useRef<string>("");

  useEffect(() => {
    if (!tableNo) router.replace("/");
  }, [tableNo]);

  const loadMenu = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_items")
      .select(MENU_COLS)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      Alert.alert("โหลดเมนูไม่สำเร็จ", error.message);
      return;
    }
    const sig = stableStringify(data || []);
    if (sig !== menuSigRef.current) {
      menuSigRef.current = sig;
      setMenu((data as any[]) || []);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const filtered = useMemo(() => {
    const qq = (q || "").trim().toLowerCase();
    return menu.filter((m) => {
      if (cat !== "ทั้งหมด" && m.category !== cat) return false;
      if (!qq) return true;
      const t = `${m.name_th || ""} ${(m.description || "")}`.toLowerCase();
      return t.includes(qq);
    });
  }, [menu, cat, q]);

  const openCustomize = (item: MenuItem) => {
    const groups = getOptionGroups(item.category);
    const defaults: Record<string, string> = {};
    for (const g of groups) defaults[g.key] = g.choices[0]?.label ?? "";
    setPicked(item);
    setOptions(defaults);
    setNote("");
    setCustomOpen(true);
  };

  const cartCount = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);

  return (
    <View style={s.page}>
      <View style={s.top}>
        <View style={s.badge}>
          <Text style={s.badgeText}>โต๊ะ {tableNo}</Text>
          <Text style={s.badgeSub}>Session {sessionId.slice(-6)}</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable style={s.cartBtn} onPress={() => router.push("/cart")}>
            <Text style={s.cartBtnText}>ดูตะกร้า ({cartCount})</Text>
          </Pressable>
          <Pressable style={s.cartBtn} onPress={() => router.push("/orders")}>
            <Text style={s.cartBtnText}>สถานะออเดอร์</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="ค้นหาเมนู..."
        placeholderTextColor="rgba(43,30,20,0.35)"
        style={s.search}
        onFocus={() => setIsTyping(true)}
        onBlur={() => setIsTyping(false)}
      />

      <View style={s.catRow}>
        {CATS.map((c) => (
          <Pressable key={c} style={[s.chip, c === cat && s.chipOn]} onPress={() => setCat(c)}>
            <Text style={[s.chipText, c === cat && s.chipTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.sub}>กำลังโหลดเมนู...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ paddingBottom: 110 }}
          renderItem={({ item }) => (
            <View style={s.itemCard}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={s.img} resizeMode="cover" />
                ) : (
                  <View style={s.imgPh}>
                    <Text style={s.imgPhText}>No Image</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{item.name_th}</Text>
                  {!!item.description && <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text>}
                  <View style={s.rowBetween}>
                    <Text style={s.price}>{formatTHB(Number(item.price_thb || 0))}</Text>
                    <Text style={s.stock}>สต็อก {item.stock ?? 0}</Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Pressable
                  style={[s.btn, (item.stock ?? 0) <= 0 && { opacity: 0.5 }]}
                  onPress={() => {
                    if ((item.stock ?? 0) <= 0) return;
                    openCustomize(item);
                  }}
                >
                  <Text style={s.btnText}>เพิ่มเข้าตะกร้า</Text>
                </Pressable>

                <Pressable style={s.btn2} onPress={loadMenu}>
                  <Text style={s.btn2Text}>รีเฟรช</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal transparent visible={customOpen} animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{picked?.name_th || "ปรับตัวเลือก"}</Text>

            {picked ? (
              <>
                {getOptionGroups(picked.category).map((g) => (
                  <View key={g.key} style={{ marginBottom: 10 }}>
                    <Text style={s.modalLabel}>{g.label}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {g.choices.map((c) => {
                        const on = options[g.key] === c.label;
                        return (
                          <Pressable
                            key={c.label}
                            style={[s.optChip, on && s.optChipOn]}
                            onPress={() => setOptions((p) => ({ ...p, [g.key]: c.label }))}
                          >
                            <Text style={[s.optChipText, on && s.optChipTextOn]}>
                              {c.label}{c.extra_thb ? ` +${c.extra_thb}` : ""}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}

                <Text style={s.modalLabel}>โน้ต</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="เช่น ไม่เผ็ด, ไม่ผัก"
                  placeholderTextColor="rgba(43,30,20,0.35)"
                  style={s.note}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable
                    style={s.btn}
                    onPress={() => {
                      const groups = getOptionGroups(picked.category);
                      for (const g of groups) {
                        if (g.required && !options[g.key]) {
                          return Alert.alert("เลือกตัวเลือกให้ครบ", `กรุณาเลือก: ${g.label}`);
                        }
                      }
                      const extra = calcExtra(options, groups);
                      addToCart(picked, options, note, extra);
                      setCustomOpen(false);
                    }}
                  >
                    <Text style={s.btnText}>
                      เพิ่ม ({formatTHB(Number(picked.price_thb || 0) + calcExtra(options, getOptionGroups(picked.category)))})
                    </Text>
                  </Pressable>

                  <Pressable style={s.btn2} onPress={() => setCustomOpen(false)}>
                    <Text style={s.btn2Text}>ยกเลิก</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, padding: 12, backgroundColor: C.bg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14 },
  badgeText: { color: C.text, fontWeight: "900" },
  badgeSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  cartBtn: { backgroundColor: "#EAD7C2", borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  cartBtnText: { color: C.text, fontWeight: "900" },
  search: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: C.text, backgroundColor: "#FFFDF9", marginBottom: 10 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.soft },
  chipOn: { backgroundColor: C.primary },
  chipText: { color: C.text, fontWeight: "800" },
  chipTextOn: { color: "#fff" },

  itemCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 10 },
  img: { width: 72, height: 72, borderRadius: 14, backgroundColor: "#EEE" },
  imgPh: { width: 72, height: 72, borderRadius: 14, backgroundColor: "#E7D6C4", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line },
  imgPhText: { color: C.sub, fontSize: 11, fontWeight: "800" },

  itemName: { color: C.text, fontWeight: "900", fontSize: 16 },
  itemDesc: { color: C.sub, marginTop: 2 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  price: { color: C.text, fontWeight: "900" },
  stock: { color: C.sub, fontWeight: "800" },

  btn: { flex: 1, backgroundColor: C.primary, paddingVertical: 11, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "900" },
  btn2: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, alignItems: "center", backgroundColor: C.soft, borderWidth: 1, borderColor: C.line },
  btn2Text: { color: C.text, fontWeight: "900" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sub: { color: C.sub, marginTop: 8 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 520, backgroundColor: "#FFF8EE", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.line },
  modalTitle: { fontSize: 18, fontWeight: "900", color: C.text, marginBottom: 8 },
  modalLabel: { color: C.text, fontWeight: "900", marginBottom: 6 },
  optChip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.soft, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999 },
  optChipOn: { backgroundColor: C.primary },
  optChipText: { color: C.text, fontWeight: "800" },
  optChipTextOn: { color: "#fff" },

  note: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: C.text, backgroundColor: "#FFFDF9" },
});
