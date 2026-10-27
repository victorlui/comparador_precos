import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";

const cameraIcon = require("../../../assets/icons/camera.svg");

type HomeHeroCardProps = {
  onPress: () => void;
};

export function HomeHeroCard({ onPress }: HomeHeroCardProps) {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, {
          duration: 950,
          easing: Easing.out(Easing.ease),
        }),
        withTiming(1, {
          duration: 950,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, [pulseScale]);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <TouchableOpacity style={styles.heroCard} onPress={onPress}>
      <View style={styles.heroBlueGlow} />
      <View style={styles.heroGreenGlow} />
      <View style={styles.heroOrangeGlow} />

      <Animated.View style={[styles.heroIconWrap, pulseAnimatedStyle]}>
        <View style={styles.heroIconInner}>
          <Image
            source={cameraIcon}
            style={styles.heroIcon}
            contentFit="contain"
          />
        </View>
      </Animated.View>

      <ThemedText style={styles.heroTitle}>ESCANEAR PRODUTO</ThemedText>
      <ThemedText style={styles.heroText}>
        Aponte a câmera e descubra o menor preço em segundos.
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: "#0473D9",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  heroBlueGlow: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(2,95,191,0.88)",
  },
  heroGreenGlow: {
    position: "absolute",
    top: -30,
    left: -24,
    width: 150,
    height: 90,
    borderRadius: 90,
    backgroundColor: "rgba(56, 255, 173, 0.42)",
    transform: [{ rotate: "-10deg" }],
  },
  heroOrangeGlow: {
    position: "absolute",
    right: -34,
    bottom: -30,
    width: 170,
    height: 120,
    borderRadius: 80,
    backgroundColor: "rgba(255, 145, 48, 0.84)",
    transform: [{ rotate: "-24deg" }],
  },
  heroIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcon: {
    width: 26,
    height: 26,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  heroText: {
    marginTop: 8,
    maxWidth: 280,
    color: "rgba(255,255,255,0.94)",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    textAlign: "center",
  },
});
