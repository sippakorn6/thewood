import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "หน้าแรก" }} />
      <Tabs.Screen name="cart" options={{ title: "ตะกร้า" }} />
      <Tabs.Screen name="status" options={{ title: "สถานะ" }} />
      <Tabs.Screen name="shop" options={{ title: "ร้านค้า" }} />
    </Tabs>
  );
}
