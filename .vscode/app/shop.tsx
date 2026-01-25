import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error("Missing Supabase env. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON);
}
const supabase = getSupabase();

const COLORS = {
  bg: "#F7F1E6",
  card: "#FFF8EE",
  wood: "#8B6B4F",
  text: "#2B1E14",
  muted: "#6B4E3B",
  border: "#E6D6C3",
  white: "#FFFFFF",
  danger: "#B23A3A",
};

const UI = { pad: 16, r: 18 };

function uid() {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: UI.r,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}

function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const bg =
    variant === "primary" ? COLORS.wood : variant === "danger" ? COLORS.danger : COLORS.white;

  const border = variant === "secondary" ? COLORS.border : "transparent";
  const textColor = variant === "secondary" ? COLORS.text : "white";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: bg,
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: "center",
        borderWidth: variant === "secondary" ? 1 : 0,
        borderColor: border,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: textColor, fontWeight: "900" }}>{title}</Text>
    </Pressable>
  );
}

type MenuItemRow = {
  id: string;
  name_th: string;
  category: string | null;
  price_thb: number | null;
  stock: number | null;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean | null;
  created_at?: number | null;
};

type OrderRow = {
  id: string;
  status: string;
  created_at?: number | null;
  table_no?: string | null;
};

export default function Shop() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [shopLoggedIn, setShopLoggedIn] = useState(false);

  const [tab, setTab] = useState<"ORDERS" | "MENU" | "STATS">("ORDERS");
  const [isTyping, setIsTyping] = useState(false);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [menu, setMenu] = useState<MenuItemRow[]>([]);

  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);

  const [mName, setMName] = useState("");
  const [mCat, setMCat] = useState("อาหาร");
  const [mPrice, setMPrice] = useState("0");
  const [mStock, setMStock] = useState("0");
  const [mDesc, setMDesc] = useState("");
  const [mImageUrl, setMImageUrl] = useState("");

  const pollingRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const ok = !!data.session;
      if (!mounted) return;
      if (!ok) {
        setShopLoggedIn(false);
        setChecking(false);
        router.replace("/shop-login");
        return;
      }
      setShopLoggedIn(true);
      setChecking(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const loadOrders = async () => {
    if (!shopLoggedIn || isTyping) return;
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id,session_id,table_no,status,items,total_thb,created_at,updated_at")
      .in("status", ["NEW", "ACCEPTED"])
      .order("created_at", { ascending: false });
    setLoadingOrders(false);
    if (error) return;
    setOrders((data as any[]) || []);
  };

  const loadMenu = async () => {
    if (!shopLoggedIn || isTyping) return;
    setLoadingMenu(true);
    const { data, error } = await supabase.from("menu_items").select("id,name_th,category,price_thb,stock,description,image_url,is_active,created_at").order("created_at", { ascending: false });
    setLoadingMenu(false);
    if (error) return;
    setMenu((data as any[]) || []);
  };

  useEffect(() => {
    if (!shopLoggedIn) return;

    loadOrders();
    loadMenu();

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      if (!shopLoggedIn || isTyping) return;
      loadOrders();
    }, 3500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [shopLoggedIn, isTyping]);

  const acceptOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").update({ status: "ACCEPTED" }).eq("id", orderId);
    if (error) return Alert.alert("ผิดพลาด", error.message);
    loadOrders();
  };

  const serveOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").update({ status: "SERVED" }).eq("id", orderId);
    if (error) return Alert.alert("ผิดพลาด", error.message);
    loadOrders();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/shop-login");
  };

  const addMenu = async () => {
    if (!mName.trim()) return;

    const priceNum = Number(mPrice || "0");
    const stockNum = Number(mStock || "0");

    const payload: any = {
      name_th: mName.trim(),
      category: mCat.trim() || "อาหาร",
      price_thb: isNaN(priceNum) ? 0 : priceNum,
      stock: isNaN(stockNum) ? 0 : stockNum,
      description: mDesc.trim() || "",
      image_url: mImageUrl.trim() || null,
      is_active: true,
    };

    const { error } = await supabase.from("menu_items").insert([payload]);
    if (error) return Alert.alert("เพิ่มเมนูไม่สำเร็จ", error.message);

    setMName("");
    setMDesc("");
    setMImageUrl("");
    setMPrice("0");
    setMStock("0");
    loadMenu();
  };

  const updateStock = async (itemId: string, nextStock: number) => {
    const { error } = await supabase.from("menu_items").update({ stock: nextStock }).eq("id", itemId);
    if (error) return Alert.alert("ผิดพลาด", error.message);
    loadMenu();
  };

  const softDeleteMenu = async (itemId: string) => {
    const { error } = await supabase.from("menu_items").update({ is_active: false }).eq("id", itemId);
    if (error) return Alert.alert("ลบไม่สำเร็จ", error.message);
    loadMenu();
  };

  const todayCount = useMemo(() => orders.length, [orders]);

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!shopLoggedIn) return null;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View
        style={{
          padding: UI.pad,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <View>
          <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>The Wood — ร้านค้า</Text>
        </View>

        <Pressable
          onPress={logout}
          style={{
            backgroundColor: COLORS.white,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: COLORS.text, fontWeight: "900" }}>ออกจากระบบ</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: UI.pad, paddingTop: 12 }}>
        {(["ORDERS", "MENU", "STATS"] as const).map((k) => {
          const active = tab === k;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? COLORS.wood : COLORS.border,
                backgroundColor: active ? COLORS.wood : COLORS.white,
              }}
            >
              <Text style={{ color: active ? "white" : COLORS.text, fontWeight: "900" }}>{k}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "ORDERS" && (
        <View style={{ flex: 1, padding: UI.pad, gap: 12 }}>
          <Card>
            <Text style={{ fontWeight: "900", color: COLORS.text }}>ออเดอร์ ({orders.length})</Text>
            <Button title="รีเฟรช" onPress={loadOrders} variant="secondary" />
          </Card>

          <FlatList
            data={orders}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <Card>
                <Text style={{ fontWeight: "900", color: COLORS.text }}>โต๊ะ: {item.table_no ?? "-"}</Text>
                <Text style={{ color: COLORS.muted }}>สถานะ: {item.status}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {item.status === "NEW" && <Button title="รับออเดอร์" onPress={() => acceptOrder(item.id)} />}
                  {item.status === "ACCEPTED" && (
                    <Button title="เสิร์ฟแล้ว" onPress={() => serveOrder(item.id)} variant="secondary" />
                  )}
                </View>
              </Card>
            )}
          />
        </View>
      )}

      {tab === "MENU" && (
        <ScrollView contentContainerStyle={{ padding: UI.pad, gap: 12, paddingBottom: 40 }}>
          <Card>
            <Text style={{ fontWeight: "900", color: COLORS.text }}>เพิ่มเมนู</Text>

            <TextInput value={mName} onChangeText={setMName} placeholder="ชื่อเมนู" onFocus={()=>setIsTyping(true)} onBlur={()=>setIsTyping(false)}
              style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: Platform.OS==="web"?10:12, backgroundColor: COLORS.white, color: COLORS.text }}
            />
            <TextInput value={mCat} onChangeText={setMCat} placeholder="หมวด" onFocus={()=>setIsTyping(true)} onBlur={()=>setIsTyping(false)}
              style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: Platform.OS==="web"?10:12, backgroundColor: COLORS.white, color: COLORS.text }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput value={mPrice} onChangeText={setMPrice} placeholder="ราคา" onFocus={()=>setIsTyping(true)} onBlur={()=>setIsTyping(false)}
                style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: Platform.OS==="web"?10:12, backgroundColor: COLORS.white, color: COLORS.text }}
              />
              <TextInput value={mStock} onChangeText={setMStock} placeholder="สต็อก" onFocus={()=>setIsTyping(true)} onBlur={()=>setIsTyping(false)}
                style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: Platform.OS==="web"?10:12, backgroundColor: COLORS.white, color: COLORS.text }}
              />
            </View>
            <TextInput value={mImageUrl} onChangeText={setMImageUrl} placeholder="ลิงก์รูปภาพ (image_url)" onFocus={()=>setIsTyping(true)} onBlur={()=>setIsTyping(false)}
              style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: Platform.OS==="web"?10:12, backgroundColor: COLORS.white, color: COLORS.text }}
            />
            <TextInput value={mDesc} onChangeText={setMDesc} placeholder="รายละเอียด" onFocus={()=>setIsTyping(true)} onBlur={()=>setIsTyping(false)}
              style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: Platform.OS==="web"?10:12, backgroundColor: COLORS.white, color: COLORS.text }}
            />

            <Button title="เพิ่มเมนู" onPress={addMenu} />
            <Button title="รีเฟรชเมนู" onPress={loadMenu} variant="secondary" />
          </Card>

          {menu.map((it) => (
            <Card key={it.id}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {!!it.image_url && (
                  <Image source={{ uri: it.image_url }} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: COLORS.border }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: COLORS.text }}>{it.name}</Text>
                  <Text style={{ color: COLORS.muted }}>
                    {it.category ?? "-"} | ฿{it.price ?? 0} | สต็อก {it.stock ?? 0} | {it.is_active ? "ACTIVE" : "HIDDEN"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Button title="+ สต็อก" onPress={() => updateStock(it.id, (it.stock ?? 0) + 1)} variant="secondary" />
                <Button title="- สต็อก" onPress={() => updateStock(it.id, Math.max(0, (it.stock ?? 0) - 1))} variant="secondary" />
                <Button title="ลบเมนู" onPress={() => softDeleteMenu(it.id)} variant="danger" />
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      {tab === "STATS" && (
        <View style={{ flex: 1, padding: UI.pad, gap: 12 }}>
          <Card>
            <Text style={{ fontWeight: "900", color: COLORS.text }}>สถิติวันนี้</Text>
            <Text style={{ color: COLORS.muted }}>ออเดอร์ที่กำลังทำ: {todayCount}</Text>
          </Card>
        </View>
      )}
    </View>
  );
}
