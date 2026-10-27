import { Image } from "expo-image";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset =
    Platform.OS === "android" ? Math.max(insets.bottom, 12) : insets.bottom;
  const tabBarPaddingTop = 8;
  const tabBarPaddingBottom = bottomInset + 10;
  const tabBarHeight = 54 + tabBarPaddingTop + tabBarPaddingBottom;

  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#222222",
          tabBarInactiveTintColor: "#94A3B8",
          tabBarStyle: {
            height: tabBarHeight,
            paddingTop: tabBarPaddingTop,
            paddingBottom: tabBarPaddingBottom,
            borderTopColor: "#E2E8F0",
            backgroundColor: "#FFFFFF",
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "700",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) => (
              <Image
                source={require("@/assets/icons/home.svg")}
                style={{
                  width: 24,
                  height: 24,
                  tintColor: focused ? "#053E38" : "#888888",
                }}
                contentFit="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "Histórico",
            tabBarIcon: ({ focused }) => (
              <Image
                source={require("@/assets/icons/history.svg")}
                style={{
                  width: 24,
                  height: 24,
                  tintColor: focused ? "#053E38" : "#888888",
                }}
                contentFit="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: "Favoritos",
            tabBarIcon: ({ focused }) => (
              <Image
                source={require("@/assets/icons/favorite.svg")}
                style={{
                  width: 24,
                  height: 24,
                  tintColor: focused ? "#053E38" : "#888888",
                }}
                contentFit="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            tabBarIcon: ({ focused }) => (
              <Image
                source={require("@/assets/icons/profile.svg")}
                style={{
                  width: 20,
                  height: 20,
                  tintColor: focused ? "#053E38" : "#888888",
                }}
                contentFit="contain"
              />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
