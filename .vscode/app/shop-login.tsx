import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, Platform, Image, ScrollView } from "react-native";
import { useRouter } from "expo-router";
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

const COLORS = {
  bg: "#F7F1E6",
  card: "#FFF8EE",
  woodDark: "#8B6B4F",
  text: "#2B1E14",
  muted: "#6B4E3B",
  border: "#E6D6C3",
  white: "#FFFFFF",
};

export default function ShopLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("กรอกข้อมูลไม่ครบ", "กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (error) {
        Alert.alert("เข้าสู่ระบบไม่สำเร็จ", error.message);
        return;
      }
      router.replace("/shop");
    } catch (e: any) {
      Alert.alert("ผิดพลาด", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {/* logo optional */}
          <Image source={require("../assets/logo.jpeg")} style={{ width: 44, height: 44, borderRadius: 14 }} />
          <View>
            <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>The Wood</Text>
            <Text style={{ color: COLORS.muted }}>Shop Login</Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            padding: 14,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>เข้าสู่ระบบร้านค้า</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: Platform.OS === "web" ? 10 : 12,
              backgroundColor: COLORS.white,
              color: COLORS.text,
            }}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: Platform.OS === "web" ? 10 : 12,
              backgroundColor: COLORS.white,
              color: COLORS.text,
            }}
          />

          <Pressable
            onPress={onLogin}
            disabled={loading}
            style={{
              backgroundColor: COLORS.woodDark,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>{loading ? "กำลังเข้าสู่ระบบ..." : "Login"}</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace("/(tabs)")}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              backgroundColor: COLORS.white,
            }}
          >
            <Text style={{ color: COLORS.text, fontWeight: "800" }}>กลับหน้าลูกค้า</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
