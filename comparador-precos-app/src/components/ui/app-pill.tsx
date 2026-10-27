import { StyleProp, StyleSheet, TextStyle, ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type AppPillProps = {
  label: string;
  tone?: "neutral" | "success";
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function AppPill({
  label,
  tone = "neutral",
  size = "sm",
  style,
  textStyle,
}: AppPillProps) {
  return (
    <ThemedView
      style={[
        styles.base,
        tone === "success" ? styles.success : styles.neutral,
        size === "md" ? styles.md : styles.sm,
        style,
      ]}
    >
      <ThemedText
        style={[
          styles.text,
          tone === "success" ? styles.successText : styles.neutralText,
          size === "md" ? styles.mdText : styles.smText,
          textStyle,
        ]}
      >
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  neutral: {
    backgroundColor: "#EEF2F7",
  },
  success: {
    backgroundColor: "#E9F7F2",
  },
  sm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  text: {
    fontWeight: "700",
  },
  neutralText: {
    color: "#475569",
  },
  successText: {
    color: "#0F4C45",
  },
  smText: {
    fontSize: 11,
  },
  mdText: {
    fontSize: 12,
  },
});
