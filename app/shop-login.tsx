import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useApp } from "./_layout";

const C = {
  bg: "#FFF8EE",
  card: "#FFF1E3",
  line: "rgba(139, 107, 79, 0.22)",
  text: "#2B1E14",
  sub: "rgba(43, 30, 20, 0.65)",
  primary: "#B88A5A",
  soft: "#F0E4D6",
};

export default function ShopLogin() {
  const router = useRouter();
  const { setMode, setIsTyping, setShopLoggedIn } = useApp();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) throw error;
      setShopLoggedIn(true);
      setMode("SHOP_APP");
      router.replace("/shop");
    } catch (e: any) {
      Alert.alert("Login ไม่สำเร็จ", e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.page}>
      <View style={s.card}>
        <Text style={s.h1}>เข้าระบบร้านค้า</Text>
        <Text style={s.sub}>Login สำเร็จเท่านั้นถึงเข้า /shop</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="rgba(43,30,20,0.35)"
          autoCapitalize="none"
          style={s.input}
          keyboardType="email-address"
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
        />
        <TextInput
          value={pw}
          onChangeText={setPw}
          placeholder="Password"
          placeholderTextColor="rgba(43,30,20,0.35)"
          secureTextEntry
          style={s.input}
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
        />

        <Pressable style={[s.btn, loading && { opacity: 0.7 }]} onPress={login} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
        </Pressable>

        <Pressable
          style={s.btn2}
          onPress={() => {
            setMode("CUSTOMER");
            router.replace("/");
          }}
        >
          <Text style={s.btn2Text}>กลับหน้าลูกค้า</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, padding: 16, backgroundColor: C.bg, justifyContent: "center" },
  card: { borderRadius: 18, backgroundColor: C.card, padding: 16, borderWidth: 1, borderColor: C.line },
  h1: { fontSize: 22, fontWeight: "900", color: C.text, marginBottom: 6 },
  sub: { color: C.sub, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: C.text, backgroundColor: "#FFFDF9", marginBottom: 10 },
  btn: { backgroundColor: C.primary, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  btn2: { marginTop: 10, backgroundColor: C.soft, paddingVertical: 12, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: C.line },
  btn2Text: { color: C.text, fontWeight: "900" },
});
