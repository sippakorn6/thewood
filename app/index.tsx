import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
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

export default function Home() {
  const router = useRouter();
  const { tableNo, setTableNoAndResetSession, resetSession, setMode } = useApp();
  const [tn, setTn] = useState(tableNo);

  return (
    <View style={s.page}>
      <View style={s.card}>
        <Text style={s.h1}>ใส่เลขโต๊ะ</Text>
        <Text style={s.sub}>ต้องใส่ก่อนถึงเข้าเมนู/ตะกร้าได้</Text>

        <TextInput
          value={tn}
          onChangeText={setTn}
          placeholder="เช่น 1, 2, A1"
          placeholderTextColor="rgba(43,30,20,0.35)"
          style={s.input}
          keyboardType="default"
          autoCapitalize="characters"
          onFocus={() => setMode("CUSTOMER")}
        />

        <Pressable
          style={s.btn}
          onPress={() => {
            const v = (tn || "").trim();
            if (!v) return Alert.alert("กรอกเลขโต๊ะ", "กรุณาใส่เลขโต๊ะก่อน");
            setTableNoAndResetSession(v);
            router.replace("/menu");
          }}
        >
          <Text style={s.btnText}>ยืนยันเลขโต๊ะ</Text>
        </Pressable>

        <Pressable style={[s.btn2]} onPress={() => { resetSession(); setTn(""); }}>
          <Text style={s.btn2Text}>รีเซ็ตเซสชัน</Text>
        </Pressable>
      </View>

      <Pressable
        style={s.shopBtn}
        onPress={() => {
          setMode("SHOP_LOGIN");
          router.push("/shop-login");
        }}
      >
        <Text style={s.shopBtnText}>🏪 เข้าระบบร้านค้า</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, padding: 16, backgroundColor: C.bg, justifyContent: "center" },
  card: { borderRadius: 18, backgroundColor: C.card, padding: 16, borderWidth: 1, borderColor: C.line },
  h1: { fontSize: 22, fontWeight: "800", color: C.text, marginBottom: 4 },
  sub: { color: C.sub, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: C.text,
    backgroundColor: "#FFFDF9",
    marginBottom: 12,
  },
  btn: { backgroundColor: C.primary, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btn2: { marginTop: 10, backgroundColor: C.soft, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btn2Text: { color: C.text, fontWeight: "800" },
  shopBtn: { marginTop: 14, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#EAD7C2", borderWidth: 1, borderColor: C.line },
  shopBtnText: { color: C.text, fontWeight: "800" },
});
