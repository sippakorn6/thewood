import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from "react-native";

type Props = {
  onBack: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
};

export default function ShopLoginScreen({ onBack, onLogin }: Props) {
  const emailRef = useRef("");
  const passRef = useRef("");

  const [emailDraft, setEmailDraft] = useState("");
  const [passDraft, setPassDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const e = (emailDraft || "").trim();
    const p = (passDraft || "").trim();
    return e.length > 3 && e.includes("@") && p.length >= 3;
  }, [emailDraft, passDraft]);

  async function submit() {
    setErr(null);
    const email = (emailDraft || "").trim();
    const password = (passDraft || "").trim();
    if (!email || !password) {
      setErr("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    try {
      setLoading(true);
      await onLogin(email, password);
    } catch (e: any) {
      setErr(e?.message || "ล็อกอินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.card}>
            <View style={s.brandRow}>
              <View style={s.logoCircle}>
                <Text style={s.logoText}>TW</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>เข้าสู่ระบบร้านค้า</Text>
                <Text style={s.sub}>กรอกอีเมลและรหัสผ่านเพื่อเข้าระบบ</Text>
              </View>
            </View>

            {!!err && <Text style={s.err}>{err}</Text>}

            <Text style={s.label}>อีเมล</Text>
            <TextInput
              value={emailDraft}
              onChangeText={(t) => {
                setEmailDraft(t);
                emailRef.current = t;
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="example@email.com"
              style={s.input}
              returnKeyType="next"
              blurOnSubmit={false}
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no"
            />

            <Text style={s.label}>รหัสผ่าน</Text>
            <TextInput
              value={passDraft}
              onChangeText={(t) => {
                setPassDraft(t);
                passRef.current = t;
              }}
              autoCapitalize="none"
              secureTextEntry
              placeholder="••••••••"
              style={s.input}
              returnKeyType="done"
              onSubmitEditing={submit}
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no"
            />

            <Pressable
              style={[s.btn, !canSubmit && { opacity: 0.55 }]}
              disabled={!canSubmit || loading}
              onPress={submit}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text style={s.btnText}>ล็อกอิน</Text>
              )}
            </Pressable>

            <Pressable style={s.back} onPress={onBack}>
              <Text style={s.backText}>← กลับไปโหมดลูกค้า</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6FAFF" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 16 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
  },
  brandRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(125,211,252,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontWeight: "900", color: "#0B2230" },
  title: { fontSize: 18, fontWeight: "900", color: "#0B2230" },
  sub: { marginTop: 2, color: "rgba(11,34,48,0.65)" },
  label: { marginTop: 10, marginBottom: 6, fontWeight: "700", color: "#0B2230" },
  input: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  btn: {
    marginTop: 14,
    backgroundColor: "#7DD3FC",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { fontWeight: "900", color: "#0B2230" },
  back: { marginTop: 12, alignItems: "center" },
  backText: { color: "rgba(11,34,48,0.65)", fontWeight: "700" },
  err: { color: "#EF4444", fontWeight: "700", marginBottom: 8 },
});
