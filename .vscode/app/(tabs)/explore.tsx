import React from "react";
import { View, Text } from "react-native";

export default function Explore() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F1E6" }}>
      <Text style={{ fontSize: 18, fontWeight: "900", color: "#2B1E14" }}>สถานะ</Text>
      <Text style={{ marginTop: 6, color: "#6B4E3B" }}>ดูสถานะออเดอร์ได้ในหน้าลูกค้า</Text>
    </View>
  );
}
