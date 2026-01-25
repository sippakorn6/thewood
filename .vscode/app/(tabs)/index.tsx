// app/(tabs)/index.tsx
// The Wood - CUSTOMER (Stable)
// - Supabase menu_items (name_th, price_thb, image_uri, stock, category)
// - Customer: choose table -> browse -> add cart (options) -> place order -> status
// - NO auto polling while typing/modals (prevents web flicker)
// - Logo path fixed: require("../../assets/logo.jpeg")

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ToastAndroid,
  StatusBar,
} from "react-native";

function SafeImg({ uri, size = 62 }: { uri?: string | null; size?: number }) {
  if (!uri) {
    return (
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: "#E6D6C3" }} />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 14, backgroundColor: "#E6D6C3" }}
      resizeMode="cover"
    />
  );
}

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "expo-router";

function getSupabase() {
  // Use Expo public env vars (works on Web + native)
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing Supabase env. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
    );
  }
  return createClient(url, anon);
}

const supabase = getSupabase();

// The Wood - Minimal Wood Theme (warm, light brown)
const THEME = {
  bg: "#F7F1E6", // warm cream
  card: "#FFF8EE", // soft paper
  line: "rgba(139, 107, 79, 0.22)",
  text: "#2B1E14", // dark brown
  sub: "rgba(43, 30, 20, 0.65)",
  soft: "#F0E4D6", // light tan
  primary2: "#B88A5A", // wood brown
  ok: "#2E7D32",
  warn: "#C77D2B",
  danger: "#C62828",
};

const CATEGORIES = ["ทั้งหมด", "อาหาร", "ก๋วยเตี๋ยว", "เครื่องดื่ม"];

const FOOD_PROTEIN = [
  { label: "หมู", add: 0 },
  { label: "ไก่", add: 0 },
  { label: "เนื้อ", add: 10 },
  { label: "ทะเล", add: 20 },
];

const NOODLES = ["เส้นเล็ก", "เส้นใหญ่", "บะหมี่เหลือง", "มาม่า"];
const NOODLE_SIZES = [
  { label: "เล็ก", add: -10 },
  { label: "ธรรมดา", add: 0 },
  { label: "ใหญ่", add: 10 },
];

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
function toast(msg: string) {
  if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert("แจ้งเตือน", msg);
}
function normalizeCategory(m: any) {
  const c = String(m?.category || "").trim();
  if (c === "อาหาร" || c === "ก๋วยเตี๋ยว" || c === "เครื่องดื่ม") return c;
  return "อาหาร";
}
function parseItems(items_json: any) {
  try {
    const x = JSON.parse(items_json || "[]");
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
}

function Chip({ label, active, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active ? styles.chipActive : styles.chipIdle,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextActive : styles.chipTextIdle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HeaderBar({ left, right }: any) {
  return (
    <View style={styles.headerBar}>
      <View style={{ flex: 1 }}>{left}</View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        {right}
      </View>
    </View>
  );
}

function BrandLeft({ title, subtitle }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image
        source={require("../../assets/logo.jpeg")}
        style={styles.logo}
      />
      <View>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSub}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export default function CustomerScreen() {
  
  const router = useRouter();
const [tableNo, setTableNo] = useState("");
  const [tableLocked, setTableLocked] = useState(false);
  const [sessionId, setSessionId] = useState(uid("sess"));

  const [menu, setMenu] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [category, setCategory] = useState("ทั้งหมด");
  const [cart, setCart] = useState<any[]>([]);

  // typing guard (stop flicker)
  const typingRef = useRef(false);
  const markTyping = () => {
    typingRef.current = true;
    if ((markTyping as any)._t) clearTimeout((markTyping as any)._t);
    (markTyping as any)._t = setTimeout(() => {
      typingRef.current = false;
    }, 900);
  };

  // Picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedMenu, setPickedMenu] = useState<any>(null);

  const [pickProtein, setPickProtein] = useState(FOOD_PROTEIN[0]);
  const [pickNoodle, setPickNoodle] = useState(NOODLES[0]);
  const [pickNoodleSize, setPickNoodleSize] = useState(NOODLE_SIZES[1]);
  const [pickNote, setPickNote] = useState("");

  async function loadMenu() {
    try {
      setLoadingMenu(true);
      const { data, error } = await supabase
        .from("menu_items")
        .select("id,name_th,category,price_thb,stock,description,image_url,is_active,created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMenu(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("โหลดเมนูไม่สำเร็จ", String(e?.message || e));
    } finally {
      setLoadingMenu(false);
    }
  }

  async function loadOrders() {
    try {
      setLoadingOrders(true);
      const { data, error } = await supabase
        .from("orders")
        .select("id,session_id,table_no,status,items,total_thb,created_at,updated_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("โหลดออเดอร์ไม่สำเร็จ", String(e?.message || e));
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    if (tableLocked) loadOrders();
  }, [sessionId, tableLocked]);

  // light polling ONLY when not typing and no modal
  useEffect(() => {
    if (!tableLocked) return;
    let t: any = null;
    const tick = async () => {
      if (typingRef.current) return;
      if (pickerOpen) return;
      await loadOrders();
    };
    tick();
    t = setInterval(tick, 4500);
    return () => t && clearInterval(t);
  }, [tableLocked, sessionId, pickerOpen]);

  function calcFinalPrice({ base, cat, protein, noodleSize }: any) {
    let price = Number(base || 0);
    if (cat === "อาหาร") price += Number(protein?.add || 0);
    if (cat === "ก๋วยเตี๋ยว") price += Number(noodleSize?.add || 0);
    return price;
  }

  function openMenuPicker(item: any) {
    if (!tableLocked) return;
    const cat = normalizeCategory(item);
    if (Number(item.stock || 0) <= 0) {
      Alert.alert("ของหมด", "เมนูนี้หมดแล้ว");
      return;
    }
    setPickedMenu({ ...item, category: cat });
    setPickNote("");
    setPickProtein(FOOD_PROTEIN[0]);
    setPickNoodle(NOODLES[0]);
    setPickNoodleSize(NOODLE_SIZES[1]);
    setPickerOpen(true);
  }

  function addPickedToCart() {
    if (!pickedMenu) return;
    const cat = pickedMenu.category || "อาหาร";
    const base = Number(pickedMenu.price_thb ?? pickedMenu.price ?? 0);

    const finalPrice = calcFinalPrice({
      base,
      cat,
      protein: pickProtein,
      noodleSize: pickNoodleSize,
    });

    const row = {
      cart_id: uid("cart"),
      menu_id: pickedMenu.id,
      name: pickedMenu.name_th ?? pickedMenu.name ?? "เมนู",
      category: cat,
      base_price: base,
      final_price: finalPrice,
      qty: 1,
      protein: cat === "อาหาร" ? pickProtein?.label : null,
      protein_add: cat === "อาหาร" ? pickProtein?.add : 0,
      noodle: cat === "ก๋วยเตี๋ยว" ? pickNoodle : null,
      noodle_size: cat === "ก๋วยเตี๋ยว" ? pickNoodleSize?.label : null,
      noodle_size_add: cat === "ก๋วยเตี๋ยว" ? pickNoodleSize?.add : 0,
      note: cat === "อาหาร" || cat === "ก๋วยเตี๋ยว" ? pickNote : "",
    };

    setCart((p) => [...p, row]);
    setPickerOpen(false);
    toast("เพิ่มลงตะกร้าแล้ว");
  }

  function cartTotal() {
    return cart.reduce(
      (acc, it) => acc + Number(it.final_price || 0) * Number(it.qty || 1),
      0
    );
  }

  function updateQty(id: string, delta: number) {
    setCart((p) =>
      p.map((x) => {
        if (x.cart_id !== id) return x;
        return { ...x, qty: Math.max(1, Number(x.qty || 1) + delta) };
      })
    );
  }

  function removeCart(id: string) {
    setCart((p) => p.filter((x) => x.cart_id !== id));
  }

  async function placeOrder() {
    if (!tableLocked) return;
    if (cart.length === 0) return Alert.alert("ตะกร้าว่าง", "เลือกเมนูก่อน");

    try {
      const total = cartTotal();
      const payload: any = {
        order_id: uid("order"),
        table_no: String(tableNo),
        session_id: sessionId,
        items_json: JSON.stringify(
          cart.map((x) => ({
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
          }))
        ),
        note: cart.some((x) => x.note) ? "มีโน้ต" : "",
        status: "NEW",
        created_at: nowMs(),
        accepted_at_ms: null,
        served_at_ms: null,
        total_price: total,
      };

      const { error } = await supabase.from("orders").insert(payload);
      if (error) throw error;

      // update stock best-effort
      for (const it of cart) {
        const m = menu.find((x) => x.id === it.menu_id);
        if (!m) continue;
        const newStock = Math.max(
          0,
          Number(m.stock || 0) - Number(it.qty || 1)
        );
        await supabase.from("menu_items").update({ stock: newStock }).eq("id", it.menu_id);
      }

      setCart([]);
      toast("สั่งแล้ว ✅");
      await loadMenu();
      await loadOrders();
    } catch (e: any) {
      Alert.alert("สั่งไม่สำเร็จ", String(e?.message || e));
    }
  }

  const filteredMenu = useMemo(() => {
    const normalized = menu.map((m) => ({ ...m, category: normalizeCategory(m) }));
    if (category === "ทั้งหมด") return normalized;
    return normalized.filter((x) => x.category === category);
  }, [menu, category]);

  const customerOrders = useMemo(() => {
    return orders
      .filter((o) => o.session_id === sessionId)
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
  }, [orders, sessionId]);

  function MenuCard({ item }: any) {
    const out = Number(item.stock || 0) <= 0;
    const cat = item.category || normalizeCategory(item);
    const name = item.name_th ?? item.name ?? "เมนู";
    const price = item.price_thb ?? item.price ?? 0;
    return (
      <Pressable
        onPress={() => openMenuPicker(item)}
        style={[styles.menuCard, out && { opacity: 0.45 }]}
        disabled={!tableLocked}
      >
        {item.image_uri ? (
          <SafeImg uri={item.image_uri} />
        ) : (
          <View style={styles.menuImgEmpty}>
            <Text style={{ color: THEME.sub, fontWeight: "900" }}>No Image</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.menuName}>
            {cat === "ก๋วยเตี๋ยว" ? "🍜 " : cat === "อาหาร" ? "🍛 " : "🥤 "}
            {name}
          </Text>

          <View style={styles.menuMetaRow}>
            <Text style={styles.menuPrice}>฿{thb(price)}</Text>
            <Text style={styles.menuStock}>สต็อก {Number(item.stock || 0)}</Text>
          </View>

          {out && <Text style={styles.outText}>❌ ของหมด</Text>}
        </View>
      </Pressable>
    );
  }

  function MenuPickerModal() {
    if (!pickedMenu) return null;
    const cat = pickedMenu.category || "อาหาร";
    const base = Number(pickedMenu.price_thb ?? pickedMenu.price ?? 0);

    const finalPrice = calcFinalPrice({
      base,
      cat,
      protein: pickProtein,
      noodleSize: pickNoodleSize,
    });

    return (
      <Modal visible={pickerOpen} transparent animationType="fade">
        <View style={styles.modalBack}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalCard}
          >
            <ScrollView keyboardShouldPersistTaps="always">
              <Text style={styles.modalTitle}>
                {cat === "ก๋วยเตี๋ยว" ? "🍜 " : cat === "อาหาร" ? "🍛 " : "🥤 "}
                {pickedMenu.name_th ?? pickedMenu.name}
              </Text>

              <Text style={styles.modalSub}>ราคา: ฿{thb(base)}</Text>

              {cat === "อาหาร" && (
                <>
                  <Text style={styles.modalSection}>เลือกโปรตีน</Text>
                  <View style={styles.optionRow}>
                    {FOOD_PROTEIN.map((x) => (
                      <Chip
                        key={x.label}
                        label={`${x.label}${x.add === 10 ? " (+10)" : x.add === 20 ? " (+20)" : ""}`}
                        active={pickProtein.label === x.label}
                        onPress={() => setPickProtein(x)}
                      />
                    ))}
                  </View>

                  <Text style={[styles.modalSub, { marginTop: 8, fontWeight: "900" }]}>
                    รวมราคา: ฿{thb(finalPrice)}
                  </Text>
                </>
              )}

              {cat === "ก๋วยเตี๋ยว" && (
                <>
                  <Text style={styles.modalSection}>เลือกเส้น</Text>
                  <View style={styles.optionRow}>
                    {NOODLES.map((x) => (
                      <Chip key={x} label={x} active={pickNoodle === x} onPress={() => setPickNoodle(x)} />
                    ))}
                  </View>

                  <Text style={[styles.modalSection, { marginTop: 10 }]}>เลือกขนาด</Text>
                  <View style={styles.optionRow}>
                    {NOODLE_SIZES.map((x) => (
                      <Chip
                        key={x.label}
                        label={`${x.label}${x.add === -10 ? " (-10)" : x.add === 10 ? " (+10)" : ""}`}
                        active={pickNoodleSize.label === x.label}
                        onPress={() => setPickNoodleSize(x)}
                      />
                    ))}
                  </View>

                  <Text style={[styles.modalSub, { marginTop: 8, fontWeight: "900" }]}>
                    รวมราคา: ฿{thb(finalPrice)}
                  </Text>
                </>
              )}

              {(cat === "อาหาร" || cat === "ก๋วยเตี๋ยว") && (
                <>
                  <Text style={[styles.modalSection, { marginTop: 10 }]}>โน้ต</Text>
                  <TextInput
                    value={pickNote}
                    onChangeText={(t) => {
                      setPickNote(t);
                      markTyping();
                    }}
                    placeholder="เช่น ไม่เผ็ด / ไม่ใส่ผัก"
                    placeholderTextColor="rgba(43, 30, 20, 0.35)"
                    style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                    multiline
                    blurOnSubmit={false}
                  />
                </>
              )}

              <View style={{ height: 12 }} />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable style={styles.btnSoft} onPress={() => setPickerOpen(false)}>
                  <Text style={styles.btnSoftText}>ยกเลิก</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={addPickedToCart}>
                  <Text style={styles.btnPrimaryText}>เพิ่มตะกร้า</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  if (!tableLocked) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.gateWrap}>
          <View style={styles.gateCard}>
            <View style={{ alignItems: "center" }}>
              <Image source={require("../../assets/logo.jpeg")} style={styles.logoBig} />
              <Text style={styles.brandBig}>The Wood</Text>
              <Text style={styles.brandSub}>เริ่มสั่งอาหาร</Text>
            </View>

            <View style={{ height: 16 }} />

            
            <Pressable
              onPress={() => router.push("/shop-login")}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                backgroundColor: "#8B6B4F",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                zIndex: 999,
              }}
            >
              <Text style={{ color: "white", fontWeight: "900" }}>🏪 ร้านค้า</Text>
            </Pressable>

<Text style={styles.gateTitle}>🪑 เลือกโต๊ะก่อนใช้งาน</Text>
            <Text style={styles.gateSub}>ใส่เลขโต๊ะ แล้วกด “เริ่มสั่งอาหาร”</Text>

            <TextInput
              value={tableNo}
              onChangeText={(t) => {
                setTableNo(t.replace(/[^0-9]/g, ""));
                markTyping();
              }}
              placeholder="เช่น 1"
              placeholderTextColor="rgba(43, 30, 20, 0.35)"
              style={styles.input}
              keyboardType="number-pad"
              blurOnSubmit={false}
            />

            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                if (!tableNo.trim()) return Alert.alert("ยังไม่ได้ใส่โต๊ะ", "ใส่เลขโต๊ะก่อน");
                setTableLocked(true);
                toast(`โต๊ะ ${tableNo} พร้อมสั่งแล้ว`);
              }}
            >
              <Text style={styles.btnPrimaryText}>เริ่มสั่งอาหาร</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <HeaderBar
          left={<BrandLeft title="The Wood" subtitle={`โต๊ะ ${tableNo}`} />}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={styles.iconBtn} onPress={() => loadMenu()}>
                <Text style={styles.iconBtnText}>{loadingMenu ? "⏳" : "🔄"}</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => loadOrders()}>
                <Text style={styles.iconBtnText}>{loadingOrders ? "⏳" : "📦"}</Text>
              </Pressable>
            </View>
          }
        />

        <View style={styles.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
            <View style={styles.chipsRow}>
              {CATEGORIES.map((c) => (
                <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>
          </ScrollView>
        </View>

        <FlatList
          data={filteredMenu}
          keyExtractor={(x) => String(x.id)}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ padding: 14, paddingBottom: 160 }}
          renderItem={({ item }) => <MenuCard item={item} />}
          ListEmptyComponent={
            <View style={{ padding: 14 }}>
              <Text style={{ color: THEME.sub }}>ยังไม่มีเมนู</Text>
            </View>
          }
        />

        <View style={styles.bottomBar}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", color: THEME.text }}>🛒 {cart.length} รายการ</Text>
            <Text style={{ color: THEME.sub, fontWeight: "800" }}>รวม ฿{thb(cartTotal())}</Text>
          </View>

          <Pressable style={styles.btnPrimarySmall} onPress={placeOrder}>
            <Text style={styles.btnPrimaryText}>สั่งอาหาร</Text>
          </Pressable>
        </View>

        <MenuPickerModal />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },

  headerBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    backgroundColor: THEME.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: THEME.text },
  headerSub: { marginTop: 2, color: THEME.sub, fontWeight: "700" },

  logo: { width: 34, height: 34, borderRadius: 10 },
  logoBig: { width: 88, height: 88, borderRadius: 22 },
  brandBig: { marginTop: 10, fontSize: 26, fontWeight: "900", color: THEME.text },
  brandSub: { marginTop: 4, color: THEME.sub, fontWeight: "800" },

  iconBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  iconBtnText: { fontWeight: "900", color: THEME.text },

  gateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  gateCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 22,
    padding: 16,
  },
  gateTitle: { fontSize: 20, fontWeight: "900", color: THEME.text },
  gateSub: { marginTop: 6, color: THEME.sub, fontWeight: "700" },

  chipsWrap: {
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: THEME.bg,
  },
  chipsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.line,
    maxWidth: 140,
  },
  chipIdle: { backgroundColor: THEME.soft },
  chipActive: { backgroundColor: THEME.primary2 },
  chipText: { fontWeight: "900" },
  chipTextIdle: { color: THEME.text },
  chipTextActive: { color: "#fff" },

  input: {
    marginTop: 10,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontWeight: "800",
  },

  btnPrimary: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: THEME.primary2,
    alignItems: "center",
  },
  btnPrimarySmall: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: THEME.primary2,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  btnSoft: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: "center",
  },
  btnSoftText: { color: THEME.text, fontWeight: "900" },

  card: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 22,
    padding: 14,
  },

  menuCard: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 22,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  menuImg: { width: 78, height: 78, borderRadius: 18, backgroundColor: THEME.soft },
  menuImgEmpty: {
    width: 78,
    height: 78,
    borderRadius: 18,
    backgroundColor: THEME.soft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.line,
  },
  menuName: { fontSize: 16, fontWeight: "900", color: THEME.text },
  menuMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  menuPrice: { fontSize: 16, fontWeight: "900", color: THEME.text },
  menuStock: { color: THEME.sub, fontWeight: "800" },
  outText: { marginTop: 6, color: THEME.danger, fontWeight: "900" },

  modalBack: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 22,
    padding: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: THEME.text },
  modalSub: { marginTop: 6, color: THEME.sub, fontWeight: "700" },
  modalSection: { marginTop: 10, fontWeight: "900", color: THEME.text },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
});
