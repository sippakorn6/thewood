import { Tabs } from "expo-router";
import React from "react";
import { Colors } from "@/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.woodDark,
        tabBarInactiveTintColor: Colors.light.muted,
        tabBarStyle: {
          backgroundColor: Colors.light.card,
          borderTopColor: Colors.light.border,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "ลูกค้า" }} />
      <Tabs.Screen name="shop" options={{ title: "ร้านค้า" }} />
    </Tabs>
  );
}
