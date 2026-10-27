import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function AppStack() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="camera" />
        <Stack.Screen name="results" />
      </Stack>
    </>
  );
}
