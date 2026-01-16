// App.js (FULL)
// Expo Snack / Expo Web friendly (JS)
// - Customer + Shop
// - Supabase storage: menu_items / orders / served_history
// - Shop login via Supabase Auth (email + password)
// - Add menu button (name/desc/category/price/stock/image_url)
// - Logo on every page (assets/logo.jpeg)
// - Keyboard not auto hide (keyboardShouldPersistTaps + blurOnSubmit + KeyboardAvoidingView)
// - NEW orders always on top
// NOTE: Requires dependency: @supabase/supabase-js

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
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qiurgxsipiztibtinxrk.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdXJneHNpcGl6dGlidGlueHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NDQzNDUsImV4cCI6MjA4NDAyMDM0NX0.mPra9_UXUk0ntO3448uEnsK_sIOjemQEIBzvSTn9FBs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const THEME = {
  bg: "#F6FBFF",
  card: "#FFFFFF",
  line: "rgba(15, 60, 110, 0.12)",
  text: "#0B2230",
  sub: "rgba(11,34,48,0.68)",
  soft: "#EAF4FF",
  primary: "#5AA9FF",
  primary2: "#2E7DFF",
  ok: "#1FBF75",
  warn: "#FFB020",
  danger: "#FF4D4D",
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
function thb(n) {
  const x = Number(n || 0);
  return x.toLocaleString("th-TH");
}
function fmtWait(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s} วิ`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m} นาที ${r} วิ`;
}
function toast(msg) {
  if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert("แจ้งเตือน", msg);
}
function normalizeCategory(m) {
  const c = (m?.category || "").trim();
  if (c === "อาหาร" || c === "ก๋วยเตี๋ยว" || c === "เครื่องดื่ม") return c;
  return "อาหาร";
}
function parseItems(items_json) {
  try {
    const x = JSON.parse(items_json || "[]");
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function HeaderBar({ left, right }) {
  return (
    <View style={styles.headerBar}>
      <View style={{ flex: 1 }}>{left}</View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>{right}</View>
    </View>
  );
}

function BrandLeft({ title, subtitle }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image source={require("../../assets/logo.jpeg")} style={styles.logo} />
      <View>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSub}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export default function App() {
  const [mode, setMode] = useState("CUSTOMER"); // CUSTOMER | SHOP
  const [tab, setTab] = useState("MENU"); // MENU | CART | STATUS | SHOP_ORDERS | SHOP_STOCK | SHOP_HISTORY | SHOP_STATS

  const [tableNo, setTableNo] = useState("");
  const [tableLocked, setTableLocked] = useState(false);
  const [sessionId, setSessionId] = useState(uid("sess"));

  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [servedHistory, setServedHistory] = useState([]);

  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [category, setCategory] = useState("ทั้งหมด");
  const [cart, setCart] = useState([]);

  // Shop login via Supabase Auth
  const [shopLoggedIn, setShopLoggedIn] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  
  // Web UX: stop shop polling while typing (prevents flicker)
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);
// Picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedMenu, setPickedMenu] = useState(null);

  const [pickProtein, setPickProtein] = useState(FOOD_PROTEIN[0]);
  const [pickNoodle, setPickNoodle] = useState(NOODLES[0]);
  const [pickNoodleSize, setPickNoodleSize] = useState(NOODLE_SIZES[1]);
  const [pickNote, setPickNote] = useState("");
  const [noteWarn, setNoteWarn] = useState(false);

  // Shop preview modal (new order)
  const [shopPreviewOpen, setShopPreviewOpen] = useState(false);
const [shopPreviewOrder, setShopPreviewOrder] = useState(null);

  // Add menu modal
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  

  // Stop polling while any modal is open (prevents web flicker + input losing focus)
  const stopPolling = loginOpen || pickerOpen || addMenuOpen || shopPreviewOpen || isTyping;
const [mName, setMName] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mCategory, setMCategory] = useState("อาหาร");
  const [mPrice, setMPrice] = useState("");
  const [mStock, setMStock] = useState("10");
  const [mImageUrl, setMImageUrl] = useState("");

  const lastSeenNewIdsRef = useRef(new Set());

  

  function sameOrderList(a, b) {
    try {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if ((a[i]?.order_id || "") !== (b[i]?.order_id || "")) return false;
        if ((a[i]?.status || "") !== (b[i]?.status || "")) return false;
        if (Number(a[i]?.created_at_ms || 0) !== Number(b[i]?.created_at_ms || 0)) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
function smartWarn(txt) {
    const s = (txt || "").toLowerCase();
    const bad = ["แพ้", "ห้าม", "ไม่เอา", "ถั่ว", "กุ้ง", "นม", "ไข่"];
    setNoteWarn(bad.some((w) => s.includes(w)));
  }

  async function loadMenu() {
    try {
      setLoadingMenu(true);
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("created_at_ms", { ascending: false });
      if (error) throw error;
      setMenu(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("โหลดเมนูไม่สำเร็จ", String(e.message || e));
    } finally {
      setLoadingMenu(false);
    }
  }

  async function loadOrders() {
    try {
      setLoadingOrders(true);

      let query = supabase.from("orders").select("*").order("created_at_ms", { ascending: false });
      if (mode === "CUSTOMER") query = query.eq("session_id", sessionId);

      const { data, error } = await query;
      if (error) throw error;
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("โหลดออเดอร์ไม่สำเร็จ", String(e.message || e));
    } finally {
      setLoadingOrders(false);
    }
  }

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from("served_history")
        .select("*")
        .order("served_at_ms", { ascending: false });
      if (error) throw error;
      setServedHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("โหลดประวัติไม่สำเร็จ", String(e.message || e));
    } finally {
      setLoadingHistory(false);
    }
  }

  // Auth state
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setShopLoggedIn(!!data?.session?.user);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setShopLoggedIn(!!session?.user);
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    loadMenu();
    loadOrders();
    loadHistory();
  }, []);

  useEffect(() => {
    if (mode === "CUSTOMER") loadOrders();
  }, [sessionId, mode]);

  // Shop polling for NEW (no sound)
  useEffect(() => {
    let timer = null;

    async function tickShop() {
      if (mode !== "SHOP" || !shopLoggedIn) return;
      if (stopPolling) return;
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at_ms", { ascending: false });
        if (error) throw error;

        const list = Array.isArray(data) ? data : [];
        setOrders((prev) => (sameOrderList(prev, list) ? prev : list));

        const newOrders = list.filter((o) => o.status === "NEW");
        const seen = lastSeenNewIdsRef.current;
        const newly = newOrders.filter((o) => !seen.has(o.order_id));
        if (newly.length > 0) {
          newly.forEach((o) => seen.add(o.order_id));
          setShopPreviewOrder(newly[0]);
          setShopPreviewOpen(true);
          toast("มีออเดอร์ใหม่!");
        }
      } catch {}
    }

    tickShop();
    timer = setInterval(tickShop, 2500);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [mode, shopLoggedIn, stopPolling]);

  function calcFinalPrice({ base, cat, protein, noodleSize }) {
    let price = Number(base || 0);
    if (cat === "อาหาร") price += Number(protein?.add || 0);
    if (cat === "ก๋วยเตี๋ยว") price += Number(noodleSize?.add || 0);
    return price;
  }

  function openMenuPicker(item) {
    if (!tableLocked) return;
    const cat = normalizeCategory(item);
    if (Number(item.stock || 0) <= 0) {
      Alert.alert("ของหมด", "เมนูนี้หมดแล้ว");
      return;
    }
    setPickedMenu({ ...item, category: cat });
    setPickNote("");
    setNoteWarn(false);
    setPickProtein(FOOD_PROTEIN[0]);
    setPickNoodle(NOODLES[0]);
    setPickNoodleSize(NOODLE_SIZES[1]);
    setPickerOpen(true);
  }

  function addPickedToCart() {
    if (!pickedMenu) return;
    const cat = pickedMenu.category || "อาหาร";
    const base = Number(pickedMenu.price || 0);

    const finalPrice = calcFinalPrice({
      base,
      cat,
      protein: pickProtein,
      noodleSize: pickNoodleSize,
    });

    const row = {
      cart_id: uid("cart"),
      menu_id: pickedMenu.id,
      name: pickedMenu.name,
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
    return cart.reduce((acc, it) => acc + Number(it.final_price || 0) * Number(it.qty || 1), 0);
  }

  function updateQty(id, delta) {
    setCart((p) =>
      p.map((x) => {
        if (x.cart_id !== id) return x;
        return { ...x, qty: Math.max(1, Number(x.qty || 1) + delta) };
      })
    );
  }

  function removeCart(id) {
    setCart((p) => p.filter((x) => x.cart_id !== id));
  }

  async function placeOrder() {
    if (!tableLocked) return;
    if (cart.length === 0) return Alert.alert("ตะกร้าว่าง", "เลือกเมนูก่อน");

    try {
      const total = cartTotal();

      const payload = {
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
        created_at_ms: nowMs(),
        accepted_at_ms: null,
        served_at_ms: null,
        total_price: total,
      };

      const { error } = await supabase.from("orders").insert(payload);
      if (error) throw error;

      // update stock
      for (const it of cart) {
        const m = menu.find((x) => x.id === it.menu_id);
        if (!m) continue;
        const newStock = Math.max(0, Number(m.stock || 0) - Number(it.qty || 1));
        await supabase.from("menu_items").update({ stock: newStock }).eq("id", it.menu_id);
      }

      setCart([]);
      toast("สั่งแล้ว ✅");
      await loadMenu();
      await loadOrders();
      setTab("STATUS");
    } catch (e) {
      Alert.alert("สั่งไม่สำเร็จ", String(e.message || e));
    }
  }

  async function acceptOrder(o) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "ACCEPTED", accepted_at_ms: nowMs() })
        .eq("order_id", o.order_id);
      if (error) throw error;
      toast("รับออเดอร์แล้ว");
      await loadOrders();
    } catch (e) {
      Alert.alert("รับไม่สำเร็จ", String(e.message || e));
    }
  }

  async function serveOrder(o) {
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

      toast("เสิร์ฟแล้ว");
      await loadOrders();
      await loadHistory();
    } catch (e) {
      Alert.alert("เสิร์ฟไม่สำเร็จ", String(e.message || e));
    }
  }

  async function shopLogin() {
    try {
      const email = loginEmail.trim();
      const password = loginPass;
      if (!email || !password) return Alert.alert("กรอกไม่ครบ", "ใส่อีเมลและรหัสผ่าน");

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      setLoginOpen(false);
      setMode("SHOP");
      setTab("SHOP_ORDERS");
      toast("เข้าสู่ระบบร้านค้าแล้ว");
      lastSeenNewIdsRef.current = new Set();
    } catch (e) {
      Alert.alert("เข้าสู่ระบบไม่สำเร็จ", String(e.message || e));
    }
  }

  async function shopLogout() {
    await supabase.auth.signOut();
    setMode("CUSTOMER");
    setTab("MENU");
    toast("ออกจากโหมดร้านค้าแล้ว");
  }

  async function addMenuToSupabase() {
    try {
      const name = mName.trim();
      const desc = mDesc.trim();
      const cat = mCategory;
      const price = Number(mPrice || 0);
      const stock = Number(mStock || 0);
      const image_url = mImageUrl.trim();

      if (!name) return Alert.alert("ยังไม่ได้ใส่ชื่อเมนู", "ใส่ชื่อก่อน");
      if (!price || price <= 0) return Alert.alert("ราคาไม่ถูก", "ใส่ราคาเป็นตัวเลข");

      const payload = {
        id: uid("menu"),
        name,
        desc,
        category: cat,
        price,
        stock: Math.max(0, stock),
        image_url: image_url || null,
        created_at_ms: nowMs(),
      };

      const { error } = await supabase.from("menu_items").insert(payload);
      if (error) throw error;

      setAddMenuOpen(false);
      setMName("");
      setMDesc("");
      setMCategory("อาหาร");
      setMPrice("");
      setMStock("10");
      setMImageUrl("");

      toast("เพิ่มเมนูแล้ว");
      await loadMenu();
    } catch (e) {
      Alert.alert("เพิ่มเมนูไม่สำเร็จ", String(e.message || e));
    }
  }

  const categories = useMemo(() => CATEGORIES, []);

  const filteredMenu = useMemo(() => {
    const normalized = menu.map((m) => ({ ...m, category: normalizeCategory(m) }));
    if (category === "ทั้งหมด") return normalized;
    return normalized.filter((x) => x.category === category);
  }, [menu, category]);

  const customerOrders = useMemo(() => {
    return orders
      .filter((o) => o.session_id === sessionId)
      .sort((a, b) => Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0));
  }, [orders, sessionId]);

  const shopNewOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === "NEW")
      .sort((a, b) => Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0));
  }, [orders]);

  const shopCooking = useMemo(() => {
    return orders
      .filter((o) => o.status === "ACCEPTED")
      .sort((a, b) => Number(b.accepted_at_ms || 0) - Number(a.accepted_at_ms || 0));
  }, [orders]);

  const revenueToday = useMemo(() => {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let sum = 0;
    let count = 0;
    servedHistory.forEach((h) => {
      const t = new Date(Number(h.served_at_ms || 0));
      const k = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
      if (k === key) {
        sum += Number(h.total_price || 0);
        count += 1;
      }
    });
    return { sum, count };
  }, [servedHistory]);

  const topMenusToday = useMemo(() => {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const map = new Map();
    servedHistory.forEach((h) => {
      const t = new Date(Number(h.served_at_ms || 0));
      const k = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
      if (k !== key) return;
      const items = parseItems(h.items_json);
      items.forEach((it) => {
        const name = it.name || "ไม่ทราบ";
        map.set(name, (map.get(name) || 0) + Number(it.qty || 1));
      });
    });
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [servedHistory]);

  function CustomerTableGate() {
    return (
      <View style={styles.gateWrap}>
        <View style={styles.gateCard}>
          <Pressable
            style={styles.shopFloatingBtn}
            onPress={() => {
              setLoginOpen(true);
            }}
          >
            <Text style={styles.shopFloatingText}>🏪 ร้านค้า</Text>
          </Pressable>

          <View style={{ alignItems: "center" }}>
            <Image source={require("../../assets/logo.jpeg")} style={styles.logoBig} />
            <Text style={styles.brandBig}>The Wood</Text>
            <Text style={styles.brandSub}>เริ่มสั่งอาหาร</Text>
          </View>

          <View style={{ height: 16 }} />

          <Text style={styles.gateTitle}>🪑 เลือกโต๊ะก่อนใช้งาน</Text>
          <Text style={styles.gateSub}>ใส่เลขโต๊ะ แล้วกด “เริ่มสั่งอาหาร”</Text>

          <TextInput
            value={tableNo}
            onChangeText={(t) => setTableNo(t.replace(/[^0-9]/g, ""))}
            placeholder="เช่น 1"
            placeholderTextColor="rgba(11,34,48,0.35)"
            style={styles.input}
            keyboardType="number-pad"
            blurOnSubmit={false}
          />

          <Pressable
            style={styles.btnPrimary}
            onPress={() => {
              if (!tableNo.trim()) return Alert.alert("ยังไม่ได้ใส่โต๊ะ", "ใส่เลขโต๊ะก่อน");
              setTableLocked(true);
              setTab("MENU");
              toast(`โต๊ะ ${tableNo} พร้อมสั่งแล้ว`);
            }}
          >
            <Text style={styles.btnPrimaryText}>เริ่มสั่งอาหาร</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function MenuCard({ item }) {
    const out = Number(item.stock || 0) <= 0;
    const cat = item.category || normalizeCategory(item);
    return (
      <Pressable
        onPress={() => openMenuPicker(item)}
        style={[styles.menuCard, out && { opacity: 0.45 }]}
        disabled={!tableLocked}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.menuImg} />
        ) : (
          <View style={styles.menuImgEmpty}>
            <Text style={{ color: THEME.sub, fontWeight: "900" }}>No Image</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.menuName}>
            {cat === "ก๋วยเตี๋ยว" ? "🍜 " : cat === "อาหาร" ? "🍛 " : "🥤 "}
            {item.name}
          </Text>
          <Text style={styles.menuSub} numberOfLines={2}>
            {item.desc || " "}
          </Text>

          <View style={styles.menuMetaRow}>
            <Text style={styles.menuPrice}>฿{thb(item.price)}</Text>
            <Text style={styles.menuStock}>สต็อก {Number(item.stock || 0)}</Text>
          </View>

          {out && <Text style={styles.outText}>❌ ของหมด</Text>}
        </View>
      </Pressable>
    );
  }

  function CustomerMenu() {
    return (
      <View style={{ flex: 1 }}>
        <HeaderBar
          left={<BrandLeft title="The Wood" subtitle={`โต๊ะ ${tableNo}`} />}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={styles.iconBtn} onPress={() => setTab("CART")}>
                <Text style={styles.iconBtnText}>🛒 {cart.length}</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={loadMenu}>
                <Text style={styles.iconBtnText}>{loadingMenu ? "⏳" : "🔄"}</Text>
              </Pressable>
            </View>
          }
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
          keyboardShouldPersistTaps="always"
         keyboardDismissMode="none">
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 14 }}>
            {categories.map((c) => (
              <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
        </ScrollView>

        <FlatList
          data={filteredMenu}
          keyExtractor={(x) => String(x.id)}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
          renderItem={({ item }) => <MenuCard item={item} />}
          ListEmptyComponent={
            <View style={{ padding: 14 }}>
              <Text style={{ color: THEME.sub }}>ยังไม่มีเมนู</Text>
            </View>
          }
        />
      </View>
    );
  }

  function CustomerCart() {
    return (
      <View style={{ flex: 1 }}>
        <HeaderBar
          left={<BrandLeft title="ตะกร้า" subtitle={`โต๊ะ ${tableNo}`} />}
          right={
            <Pressable style={styles.iconBtn} onPress={() => setTab("MENU")}>
              <Text style={styles.iconBtnText}>🍽️</Text>
            </Pressable>
          }
        />

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 140 }} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
          <View style={styles.card}>
            {cart.length === 0 ? (
              <Text style={{ color: THEME.sub }}>ยังไม่มีรายการ</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {cart.map((it) => (
                  <View key={it.cart_id} style={styles.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartName}>
                        {it.category === "ก๋วยเตี๋ยว" ? "🍜 " : it.category === "อาหาร" ? "🍛 " : "🥤 "}
                        {it.name}
                      </Text>

                      {it.category === "อาหาร" && (
                        <Text style={styles.cartSub}>
                          โปรตีน: {it.protein}{" "}
                          {it.protein_add === 10 ? "(+10)" : it.protein_add === 20 ? "(+20)" : ""}
                        </Text>
                      )}

                      {it.category === "ก๋วยเตี๋ยว" && (
                        <Text style={styles.cartSub}>
                          {it.noodle} • ขนาด {it.noodle_size}{" "}
                          {it.noodle_size_add === -10 ? "(-10)" : it.noodle_size_add === 10 ? "(+10)" : ""}
                        </Text>
                      )}

                      {it.note ? <Text style={[styles.cartSub, { color: THEME.danger }]}>📝 {it.note}</Text> : null}

                      <Text style={styles.cartSub}>
                        ฿{thb(it.final_price)} x {it.qty}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <Pressable style={styles.qtyBtn} onPress={() => updateQty(it.cart_id, -1)}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </Pressable>
                      <Text style={{ fontWeight: "900", color: THEME.text }}>{it.qty}</Text>
                      <Pressable style={styles.qtyBtn} onPress={() => updateQty(it.cart_id, 1)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                      <Pressable style={styles.delBtn} onPress={() => removeCart(it.cart_id)}>
                        <Text style={styles.delBtnText}>ลบ</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>รวม</Text>
              <Text style={styles.totalValue}>฿{thb(cartTotal())}</Text>
            </View>

            <Pressable style={styles.btnPrimary} onPress={placeOrder}>
              <Text style={styles.btnPrimaryText}>สั่งอาหาร</Text>
            </Pressable>

            <Pressable style={styles.btnSoft} onPress={() => setTab("STATUS")}>
              <Text style={styles.btnSoftText}>📦 ดูสถานะออเดอร์</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  function CustomerStatus() {
    return (
      <View style={{ flex: 1 }}>
        <HeaderBar
          left={<BrandLeft title="สถานะออเดอร์" subtitle={`โต๊ะ ${tableNo}`} />}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={styles.iconBtn} onPress={loadOrders}>
                <Text style={styles.iconBtnText}>{loadingOrders ? "⏳" : "🔄"}</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => setTab("MENU")}>
                <Text style={styles.iconBtnText}>🍽️</Text>
              </Pressable>
            </View>
          }
        />

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 140 }} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
          <View style={styles.card}>
            {customerOrders.length === 0 ? (
              <Text style={{ color: THEME.sub }}>ไม่มีออเดอร์</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {customerOrders.slice(0, 20).map((o) => {
                  const wait = nowMs() - Number(o.created_at_ms || 0);
                  const served = o.status === "SERVED";
                  const accepted = o.status === "ACCEPTED";
                  return (
                    <View key={o.order_id} style={styles.orderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderTitle}>
                          ฿{thb(o.total_price)} • โต๊ะ {o.table_no}
                        </Text>
                        <Text style={styles.orderSub}>
                          สถานะ:{" "}
                          <Text style={{ fontWeight: "900", color: served ? THEME.ok : accepted ? THEME.warn : THEME.sub }}>
                            {served ? "เสิร์ฟแล้ว" : accepted ? "กำลังทำ" : "รอรับ"}
                          </Text>
                        </Text>
                        {!served && <Text style={styles.orderSub}>รอมาแล้ว: {fmtWait(wait)}</Text>}
                      </View>
                      <Text style={styles.orderBadge}>{served ? "✅" : accepted ? "🍳" : "🕒"}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <Pressable
              style={styles.btnSoft}
              onPress={() => {
                setSessionId(uid("sess"));
                setCart([]);
                setTab("MENU");
              }}
            >
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  function BottomNavCustomer() {
    return (
      <View style={styles.bottomNav}>
        <Pressable style={styles.navBtn} onPress={() => setTab("MENU")}>
          <Text style={styles.navText}>🍽️ เมนู</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => setTab("CART")}>
          <Text style={styles.navText}>🛒 ตะกร้า</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => setTab("STATUS")}>
          <Text style={styles.navText}>📦 สถานะ</Text>
        </Pressable>
      </View>
    );
  }

  function ShopTabs() {
    return (
      <View style={styles.shopTabs}>
        <Pressable
          style={[styles.shopTabBtn, tab === "SHOP_ORDERS" && styles.shopTabBtnActive]}
          onPress={() => setTab("SHOP_ORDERS")}
        >
          <Text style={[styles.shopTabText, tab === "SHOP_ORDERS" && styles.shopTabTextActive]}>🧾 ออเดอร์</Text>
        </Pressable>
        <Pressable
          style={[styles.shopTabBtn, tab === "SHOP_STOCK" && styles.shopTabBtnActive]}
          onPress={() => setTab("SHOP_STOCK")}
        >
          <Text style={[styles.shopTabText, tab === "SHOP_STOCK" && styles.shopTabTextActive]}>📦 สต็อก</Text>
        </Pressable>
        <Pressable
          style={[styles.shopTabBtn, tab === "SHOP_HISTORY" && styles.shopTabBtnActive]}
          onPress={() => setTab("SHOP_HISTORY")}
        >
          <Text style={[styles.shopTabText, tab === "SHOP_HISTORY" && styles.shopTabTextActive]}>📚 เสิร์ฟ</Text>
        </Pressable>
        <Pressable
          style={[styles.shopTabBtn, tab === "SHOP_STATS" && styles.shopTabBtnActive]}
          onPress={() => setTab("SHOP_STATS")}
        >
          <Text style={[styles.shopTabText, tab === "SHOP_STATS" && styles.shopTabTextActive]}>📊 รายรับ</Text>
        </Pressable>
      </View>
    );
  }

  function ShopOrders() {
    return (
      <View style={{ flex: 1 }}>
        <HeaderBar
          left={<BrandLeft title="หลังร้าน" subtitle="The Wood" />}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={styles.iconBtn} onPress={loadOrders}>
                <Text style={styles.iconBtnText}>{loadingOrders ? "⏳" : "🔄"}</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={shopLogout}>
                <Text style={styles.iconBtnText}>🚪</Text>
              </Pressable>
            </View>
          }
        />

        <ShopTabs />

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 140 }} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🧾 ออเดอร์ใหม่ ({shopNewOrders.length})</Text>
            {shopNewOrders.length === 0 ? (
              <Text style={{ color: THEME.sub }}>ไม่มีออเดอร์</Text>
            ) : (
              <View style={{ gap: 10, marginTop: 10 }}>
                {shopNewOrders.map((o) => (
                  <Pressable
                    key={o.order_id}
                    style={styles.shopOrderCard}
                    onPress={() => {
                      setShopPreviewOrder(o);
                      setShopPreviewOpen(true);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderTitle}>
                        โต๊ะ {o.table_no} • ฿{thb(o.total_price)}
                      </Text>
                      <Text style={styles.orderSub}>รอมาแล้ว: {fmtWait(nowMs() - Number(o.created_at_ms || 0))}</Text>
                    </View>
                    <Pressable style={styles.btnOk} onPress={() => acceptOrder(o)}>
                      <Text style={styles.btnOkText}>รับ</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 12 }} />

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🍳 กำลังทำ ({shopCooking.length})</Text>
            {shopCooking.length === 0 ? (
              <Text style={{ color: THEME.sub }}>ไม่มีออเดอร์</Text>
            ) : (
              <View style={{ gap: 10, marginTop: 10 }}>
                {shopCooking.map((o) => (
                  <Pressable
                    key={o.order_id}
                    style={styles.shopOrderCard}
                    onPress={() => {
                      setShopPreviewOrder(o);
                      setShopPreviewOpen(true);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderTitle}>
                        โต๊ะ {o.table_no} • ฿{thb(o.total_price)}
                      </Text>
                      <Text style={styles.orderSub}>เวลารวม: {fmtWait(nowMs() - Number(o.created_at_ms || 0))}</Text>
                    </View>
                    <Pressable style={styles.btnPrimary} onPress={() => serveOrder(o)}>
                      <Text style={styles.btnPrimaryText}>เสิร์ฟแล้ว</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  function ShopStock() {
    return (
      <View style={{ flex: 1 }}>
        <HeaderBar
          left={<BrandLeft title="สต็อก" subtitle="จัดการเมนูวันนี้" />}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={styles.iconBtn} onPress={loadMenu}>
                <Text style={styles.iconBtnText}>{loadingMenu ? "⏳" : "🔄"}</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => setAddMenuOpen(true)}>
                <Text style={styles.iconBtnText}>➕ เมนู</Text>
              </Pressable>
            </View>
          }
        />

        <ShopTabs />

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 140 }} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
          <View style={styles.card}>
            {menu.length === 0 ? (
              <Text style={{ color: THEME.sub }}>ยังไม่มีเมนู</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {menu.map((m) => (
                  <View key={m.id} style={styles.stockRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuName}>
                        {(normalizeCategory(m) === "ก๋วยเตี๋ยว"
                          ? "🍜 "
                          : normalizeCategory(m) === "อาหาร"
                          ? "🍛 "
                          : "🥤 ") + m.name}
                      </Text>
                      <Text style={styles.menuSub}>สต็อก: {Number(m.stock || 0)}</Text>
                    </View>

                    <Pressable
                      style={styles.qtyBtn}
                      onPress={async () => {
                        const next = Math.max(0, Number(m.stock || 0) - 1);
                        await supabase.from("menu_items").update({ stock: next }).eq("id", m.id);
                        await loadMenu();
                      }}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </Pressable>

                    <Pressable
                      style={styles.qtyBtn}
                      onPress={async () => {
                        const next = Math.max(0, Number(m.stock || 0) + 1);
                        await supabase.from("menu_items").update({ stock: next }).eq("id", m.id);
                        await loadMenu();
                      }}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>

                    <Pressable
                      style={styles.btnDanger}
                      onPress={async () => {
                        await supabase.from("menu_items").update({ stock: 0 }).eq("id", m.id);
                        await loadMenu();
                      }}
                    >
                      <Text style={styles.btnDangerText}>หมด</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  function ShopHistory() {
    return (
      <View style={{ flex: 1 }}>
        <HeaderBar
          left={<BrandLeft title="ประวัติการเสิร์ฟ" subtitle="ถาวร (ไม่รีเซ็ต)" />}
          right={
            <Pressable style={styles.iconBtn} onPress={loadHistory}>
              <Text style={styles.iconBtnText}>{loadingHistory ? "⏳" : "🔄"}</Text>
            </Pressable>
          }
        />

        <ShopTabs />

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 140 }} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
          <View style={styles.card}>
            {servedHistory.length === 0 ? (
              <Text style={{ color: THEME.sub }}>ไม่มีออเดอร์</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {servedHistory.slice(0, 40).map((h) => {
                  const t = new Date(Number(h.served_at_ms || 0));
                  return (
                    <View key={h.id} style={styles.orderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderTitle}>
                          โต๊ะ {h.table_no} • ฿{thb(h.total_price)}
                        </Text>
                        <Text style={styles.orderSub}>{t.toLocaleString("th-TH")}</Text>
                      </View>
                      <Text style={styles.orderBadge}>✅</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  function ShopStats() {
    return (
      <View style={{ flex: 1 }}>
        <HeaderBar
          left={<BrandLeft title="รายรับวันนี้" subtitle="The Wood" />}
          right={
            <Pressable style={styles.iconBtn} onPress={loadHistory}>
              <Text style={styles.iconBtnText}>{loadingHistory ? "⏳" : "🔄"}</Text>
            </Pressable>
          }
        />

        <ShopTabs />

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 140 }} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
          <View style={styles.card}>
            <Text style={styles.moneyBig}>฿{thb(revenueToday.sum)}</Text>
            <Text style={styles.menuSub}>จำนวนออเดอร์ที่เสิร์ฟวันนี้: {revenueToday.count}</Text>

            <View style={{ height: 14 }} />

            <Text style={styles.sectionTitle}>🏆 Top เมนูวันนี้</Text>
            {topMenusToday.length === 0 ? (
              <Text style={{ color: THEME.sub }}>ยังไม่มีข้อมูล</Text>
            ) : (
              <View style={{ gap: 8, marginTop: 10 }}>
                {topMenusToday.map((x) => (
                  <View key={x.name} style={styles.topRow}>
                    <Text style={{ flex: 1, fontWeight: "900", color: THEME.text }}>{x.name}</Text>
                    <Text style={{ color: THEME.sub, fontWeight: "900" }}>x{x.qty}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  function MenuPickerModal() {
    if (!pickedMenu) return null;
    const cat = pickedMenu.category || "อาหาร";
    const base = Number(pickedMenu.price || 0);

    const finalPrice = calcFinalPrice({
      base,
      cat,
      protein: pickProtein,
      noodleSize: pickNoodleSize,
    });

    return (
      <Modal visible={pickerOpen} transparent animationType="fade">
        <View style={styles.modalBack}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="none">
              <Text style={styles.modalTitle}>
                {cat === "ก๋วยเตี๋ยว" ? "🍜 " : cat === "อาหาร" ? "🍛 " : "🥤 "}
                {pickedMenu.name}
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
                      smartWarn(t);
                    }}
                    placeholder="เช่น ไม่เผ็ด / ไม่ใส่ผัก / แพ้ถั่ว"
                    placeholderTextColor="rgba(11,34,48,0.35)"
                    style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                    multiline
                    blurOnSubmit={false}
                  />
                  {noteWarn && (
                    <Text style={{ marginTop: 6, color: THEME.danger, fontWeight: "900" }}>
                      🔴 มีคำเสี่ยงแพ้อาหาร/คำต้องห้าม
                    </Text>
                  )}
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

  function LoginModal() {
    return (
      <Modal visible={loginOpen} transparent animationType="fade">
        <View style={styles.modalBack}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="none">
              <Text style={styles.modalTitle}>🔐 เข้าสู่ระบบร้านค้า</Text>
              <Text style={styles.modalSub}>ใส่อีเมลและรหัสผ่าน</Text>

              <TextInput
                value={loginEmail}
                onChangeText={(t) => {
                  setLoginEmail(t);
                  setIsTyping(true);
                  if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = setTimeout(() => setIsTyping(false), 800);
                }}
                placeholder="อีเมล"
                placeholderTextColor="rgba(11,34,48,0.35)"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                blurOnSubmit={false}
              />

              <TextInput
                value={loginPass}
                onChangeText={(t) => {
                  setLoginPass(t);
                  setIsTyping(true);
                  if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = setTimeout(() => setIsTyping(false), 800);
                }}
                placeholder="รหัสผ่าน"
                placeholderTextColor="rgba(11,34,48,0.35)"
                style={styles.input}
                secureTextEntry
                blurOnSubmit={false}
              />

              <View style={{ height: 12 }} />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  style={styles.btnSoft}
                  onPress={() => {
                    setLoginOpen(false);
                    if (!shopLoggedIn) setMode("CUSTOMER");
                  }}
                >
                  <Text style={styles.btnSoftText}>ปิด</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={shopLogin}>
                  <Text style={styles.btnPrimaryText}>เข้าสู่ระบบ</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  function ShopOrderPreviewModal() {
    if (!shopPreviewOrder) return null;
    const items = parseItems(shopPreviewOrder.items_json);
    return (
      <Modal visible={shopPreviewOpen} transparent animationType="fade">
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🧾 ออเดอร์โต๊ะ {shopPreviewOrder.table_no}</Text>
            <Text style={styles.modalSub}>รวม ฿{thb(shopPreviewOrder.total_price)}</Text>

            <View style={{ height: 10 }} />

            <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
              {items.length === 0 ? (
                <Text style={{ color: THEME.sub }}>ไม่มีรายการ</Text>
              ) : (
                items.map((it, idx) => (
                  <View key={idx} style={styles.previewRow}>
                    <Text style={{ flex: 1, fontWeight: "900", color: THEME.text }}>
                      {it.name} x{it.qty}
                    </Text>
                    <Text style={{ color: THEME.sub, fontWeight: "900" }}>฿{thb(it.final_price)}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={{ height: 12 }} />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={styles.btnSoft} onPress={() => setShopPreviewOpen(false)}>
                <Text style={styles.btnSoftText}>ปิด</Text>
              </Pressable>
              {shopPreviewOrder.status === "NEW" && (
                <Pressable
                  style={styles.btnOk}
                  onPress={async () => {
                    await acceptOrder(shopPreviewOrder);
                    setShopPreviewOpen(false);
                  }}
                >
                  <Text style={styles.btnOkText}>รับออเดอร์</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function AddMenuModal() {
    return (
      <Modal visible={addMenuOpen} transparent animationType="fade">
        <View style={styles.modalBack}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="none">
              <Text style={styles.modalTitle}>➕ เพิ่มเมนูใหม่</Text>
              <Text style={styles.modalSub}>ใส่ข้อมูลให้ครบ (เก็บใน Supabase)</Text>

              <TextInput
                value={mName}
                onChangeText={setMName}
                placeholder="ชื่อเมนู"
                placeholderTextColor="rgba(11,34,48,0.35)"
                style={styles.input}
                blurOnSubmit={false}
              />

              <TextInput
                value={mDesc}
                onChangeText={setMDesc}
                placeholder="คำอธิบาย (ไม่ใส่ก็ได้)"
                placeholderTextColor="rgba(11,34,48,0.35)"
                style={styles.input}
                blurOnSubmit={false}
              />

              <Text style={[styles.modalSection, { marginTop: 10 }]}>หมวดหมู่</Text>
              <View style={styles.optionRow}>
                {["อาหาร", "ก๋วยเตี๋ยว", "เครื่องดื่ม"].map((c) => (
                  <Chip key={c} label={c} active={mCategory === c} onPress={() => setMCategory(c)} />
                ))}
              </View>

              <TextInput
                value={mPrice}
                onChangeText={(t) => setMPrice(t.replace(/[^0-9]/g, ""))}
                placeholder="ราคา (บาท)"
                placeholderTextColor="rgba(11,34,48,0.35)"
                style={styles.input}
                keyboardType="number-pad"
                blurOnSubmit={false}
              />

              <TextInput
                value={mStock}
                onChangeText={(t) => setMStock(t.replace(/[^0-9]/g, ""))}
                placeholder="สต็อกเริ่มต้น (เช่น 10)"
                placeholderTextColor="rgba(11,34,48,0.35)"
                style={styles.input}
                keyboardType="number-pad"
                blurOnSubmit={false}
              />

              <TextInput
                value={mImageUrl}
                onChangeText={setMImageUrl}
                placeholder="ลิงก์รูป (image_url) เช่น https://..."
                placeholderTextColor="rgba(11,34,48,0.35)"
                style={styles.input}
                autoCapitalize="none"
                blurOnSubmit={false}
              />

              <View style={{ height: 12 }} />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable style={styles.btnSoft} onPress={() => setAddMenuOpen(false)}>
                  <Text style={styles.btnSoftText}>ยกเลิก</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={addMenuToSupabase}>
                  <Text style={styles.btnPrimaryText}>บันทึกเมนู</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  let content = null;

  if (mode === "CUSTOMER") {
    if (!tableLocked) content = <CustomerTableGate />;
    else if (tab === "MENU") content = <CustomerMenu />;
    else if (tab === "CART") content = <CustomerCart />;
    else content = <CustomerStatus />;
  } else {
    if (!shopLoggedIn) {
      content = (
        <View style={styles.gateWrap}>
          <View style={styles.gateCard}>
            <View style={{ alignItems: "center" }}>
              <Image source={require("../../assets/logo.jpeg")} style={styles.logoBig} />
              <Text style={styles.brandBig}>The Wood</Text>
              <Text style={styles.brandSub}>โหมดร้านค้า</Text>
            </View>

            <Pressable style={styles.btnPrimary} onPress={() => setLoginOpen(true)}>
              <Text style={styles.btnPrimaryText}>เข้าสู่ระบบ</Text>
            </Pressable>

            <Pressable
              style={styles.btnSoft}
              onPress={() => {
                setMode("CUSTOMER");
                setTab("MENU");
              }}
            >
              <Text style={styles.btnSoftText}>กลับไปลูกค้า</Text>
            </Pressable>
          </View>
        </View>
      );
    } else {
      if (tab === "SHOP_ORDERS") content = <ShopOrders />;
      else if (tab === "SHOP_STOCK") content = <ShopStock />;
      else if (tab === "SHOP_HISTORY") content = <ShopHistory />;
      else content = <ShopStats />;
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {content}
        {mode === "CUSTOMER" && tableLocked && <BottomNavCustomer />}
        <MenuPickerModal />
        <LoginModal />
        <ShopOrderPreviewModal />
        <AddMenuModal />
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

  shopFloatingBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
    zIndex: 50,
  },
  shopFloatingText: { fontWeight: "900", color: THEME.text },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.line,
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

  btnOk: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: THEME.ok,
  },
  btnOkText: { color: "#fff", fontWeight: "900" },

  btnDanger: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: THEME.danger,
  },
  btnDangerText: { color: "#fff", fontWeight: "900" },

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
  menuSub: { marginTop: 3, color: THEME.sub, fontWeight: "700" },
  menuMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  menuPrice: { fontSize: 16, fontWeight: "900", color: THEME.text },
  menuStock: { color: THEME.sub, fontWeight: "800" },
  outText: { marginTop: 6, color: THEME.danger, fontWeight: "900" },

  cartRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  cartName: { fontWeight: "900", color: THEME.text },
  cartSub: { marginTop: 2, color: THEME.sub, fontWeight: "700" },

  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontWeight: "900", color: THEME.text, fontSize: 16 },

  delBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: THEME.danger,
  },
  delBtnText: { color: "#fff", fontWeight: "900" },

  totalRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { color: THEME.sub, fontWeight: "900" },
  totalValue: { fontSize: 20, fontWeight: "900", color: THEME.text },

  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  orderTitle: { fontWeight: "900", color: THEME.text },
  orderSub: { marginTop: 2, color: THEME.sub, fontWeight: "700" },
  orderBadge: { fontSize: 18 },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: "center",
  },
  navText: { fontWeight: "900", color: THEME.text },

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

  shopTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: THEME.bg,
  },
  shopTabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: "center",
  },
  shopTabBtnActive: { backgroundColor: THEME.primary2 },
  shopTabText: { fontWeight: "900", color: THEME.text },
  shopTabTextActive: { color: "#fff" },

  sectionTitle: { fontWeight: "900", color: THEME.text, fontSize: 16 },

  shopOrderCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 18,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
  },

  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
  },

  moneyBig: { fontSize: 34, fontWeight: "900", color: THEME.text, marginTop: 6 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
  },

  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
});
