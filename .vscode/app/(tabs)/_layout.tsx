import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "ลูกค้า" }} />
      <Tabs.Screen name="explore" options={{ title: "สถานะ" }} />
    </Tabs>
  );
}
