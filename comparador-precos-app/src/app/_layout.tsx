import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppStack from "@/components/app-stack";
import { AppEntryGate } from "@/components/onboarding/app-entry-gate";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <KeyboardProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <AnimatedSplashOverlay />
            <AppEntryGate>
              <AppStack />
            </AppEntryGate>
          </ThemeProvider>
        </KeyboardProvider>
      </ClerkProvider>
    </QueryClientProvider>
  );
}
