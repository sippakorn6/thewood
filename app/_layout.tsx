import React, { createContext, useContext, useMemo, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { Mode, MenuItem } from "../lib/types";
import { uid, makeCartKey } from "../lib/utils";

type CartLine = {
  key: string;
  menu_id: number;
  name_th: string;
  qty: number;
  base_price_thb: number;
  extra_thb: number;
  unit_total_thb: number;
  options: Record<string, string>;
  note: string;
  image_url?: string | null;
  category?: string;
};

type AppState = {
  mode: Mode;
  setMode: (m: Mode) => void;

  isTyping: boolean;
  setIsTyping: (v: boolean) => void;

  tableNo: string;
  sessionId: string;
  setTableNoAndResetSession: (tableNo: string) => void;
  resetSession: () => void;

  cart: CartLine[];
  addToCart: (item: MenuItem, options: Record<string, string>, note: string, extra_thb: number) => void;
  incCart: (key: string) => void;
  decCart: (key: string) => void;
  removeCart: (key: string) => void;
  clearCart: () => void;

  shopLoggedIn: boolean;
  setShopLoggedIn: (v: boolean) => void;
};

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppState missing");
  return v;
}

export default function RootLayout() {
  const [mode, setMode] = useState<Mode>("CUSTOMER");
  const [isTyping, setIsTyping] = useState(false);

  const [tableNo, setTableNo] = useState("");
  const [sessionId, setSessionId] = useState(uid("sess"));
  const [cart, setCart] = useState<CartLine[]>([]);
  const [shopLoggedIn, setShopLoggedIn] = useState(false);

  const setTableNoAndResetSession = (tn: string) => {
    const v = (tn || "").trim();
    setTableNo(v);
    setSessionId(uid("sess"));
    setCart([]);
  };

  const resetSession = () => {
    setTableNo("");
    setSessionId(uid("sess"));
    setCart([]);
  };

  const addToCart = (item: MenuItem, options: Record<string, string>, note: string, extra_thb: number) => {
    const key = makeCartKey(item.id, options, note);
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      const base = Number(item.price_thb || 0);
      const unit_total_thb = base + Number(extra_thb || 0);
      return [
        ...prev,
        {
          key,
          menu_id: item.id,
          name_th: item.name_th,
          qty: 1,
          base_price_thb: base,
          extra_thb: Number(extra_thb || 0),
          unit_total_thb,
          options,
          note: (note || "").trim(),
          image_url: item.image_url || null,
          category: item.category,
        },
      ];
    });
  };

  const incCart = (key: string) => setCart((prev) => prev.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)));
  const decCart = (key: string) =>
    setCart((prev) =>
      prev
        .map((x) => (x.key === key ? { ...x, qty: Math.max(1, x.qty - 1) } : x))
        .filter(Boolean) as any
    );
  const removeCart = (key: string) => setCart((prev) => prev.filter((x) => x.key !== key));
  const clearCart = () => setCart([]);

  const value = useMemo<AppState>(
    () => ({
      mode,
      setMode,
      isTyping,
      setIsTyping,
      tableNo,
      sessionId,
      setTableNoAndResetSession,
      resetSession,
      cart,
      addToCart,
      incCart,
      decCart,
      removeCart,
      clearCart,
      shopLoggedIn,
      setShopLoggedIn,
    }),
    [mode, isTyping, tableNo, sessionId, cart, shopLoggedIn]
  );

  return (
    <>
      <StatusBar style="dark" />
      <Ctx.Provider value={value}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#F3E6D7" },
            headerTintColor: "#2B1E14",
            contentStyle: { backgroundColor: "#FFF8EE" },
          }}
        >
          <Stack.Screen name="index" options={{ title: "The Wood" }} />
          <Stack.Screen name="menu" options={{ title: "เมนู" }} />
          <Stack.Screen name="cart" options={{ title: "ตะกร้า" }} />
          <Stack.Screen name="orders" options={{ title: "สถานะออเดอร์" }} />
          <Stack.Screen name="shop-login" options={{ title: "เข้าระบบร้านค้า" }} />
          <Stack.Screen name="shop" options={{ title: "ร้านค้า" }} />
        </Stack>
      </Ctx.Provider>
    </>
  );
}
