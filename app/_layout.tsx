import { Stack } from "expo-router";
import React from "react";

// Root Layout
// - Use a single Stack to avoid route duplication (index.tsx + shop-login.tsx + modal.tsx)
// - The real app lives inside (tabs)
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
