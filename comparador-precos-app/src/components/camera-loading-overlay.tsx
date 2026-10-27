import { Image } from "expo-image";
import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type CameraLoadingOverlayProps = {
  visible: boolean;
  photoUri?: string | null;
  title?: string;
  message?: string;
};

const THUMBNAIL_SIZE = 132;

export const CameraLoadingOverlay = memo(function CameraLoadingOverlay({
  visible,
  photoUri,
  title = "Buscando ofertas",
  message = "Analisando a foto para identificar o produto e comparar os melhores preços.",
}: CameraLoadingOverlayProps) {
  const pulse = useSharedValue(0);
  const scanProgress = useSharedValue(0);
  const dotOne = useSharedValue(0);
  const dotTwo = useSharedValue(0);
  const dotThree = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(pulse);
      cancelAnimation(scanProgress);
      cancelAnimation(dotOne);
      cancelAnimation(dotTwo);
      cancelAnimation(dotThree);
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    scanProgress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );

    const animateDot = (sharedValue: SharedValue<number>, delay: number) => {
      sharedValue.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }),
            withTiming(0.25, {
              duration: 380,
              easing: Easing.inOut(Easing.quad),
            }),
          ),
          -1,
          false,
        ),
      );
    };

    animateDot(dotOne, 0);
    animateDot(dotTwo, 140);
    animateDot(dotThree, 280);

    return () => {
      cancelAnimation(pulse);
      cancelAnimation(scanProgress);
      cancelAnimation(dotOne);
      cancelAnimation(dotTwo);
      cancelAnimation(dotThree);
    };
  }, [dotOne, dotThree, dotTwo, pulse, scanProgress, visible]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.02]) }],
  }));

  const thumbnailAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.035]) }],
  }));

  const scanLineAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scanProgress.value,
          [0, 1],
          [12, THUMBNAIL_SIZE - 16],
        ),
      },
    ],
    opacity: interpolate(scanProgress.value, [0, 0.5, 1], [0.25, 0.95, 0.25]),
  }));

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        <Animated.View style={[styles.thumbnailFrame, thumbnailAnimatedStyle]}>
          {photoUri ? (
            <Image
              style={styles.thumbnail}
              source={photoUri}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={styles.thumbnailFallback} />
          )}

          <View style={styles.thumbnailShade} />
          <View style={styles.thumbnailBadge}>
            <View style={styles.thumbnailBadgeDot} />
            <Text style={styles.thumbnailBadgeText}>IA</Text>
          </View>
          <Animated.View style={[styles.scanLine, scanLineAnimatedStyle]} />
        </Animated.View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.dotRow}>
          <LoadingDot progress={dotOne} />
          <LoadingDot progress={dotTwo} />
          <LoadingDot progress={dotThree} />
        </View>
      </Animated.View>
    </View>
  );
});

type LoadingDotProps = {
  progress: SharedValue<number>;
};

const LoadingDot = memo(function LoadingDot({ progress }: LoadingDotProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.25, 1], [0.35, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0.25, 1], [2, -4]) },
    ],
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(4, 9, 20, 0.7)",
    paddingHorizontal: 24,
    zIndex: 30,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(14, 21, 38, 0.92)",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  thumbnailFrame: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    marginBottom: 20,
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#101828",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailFallback: {
    flex: 1,
    backgroundColor: "#1F2937",
  },
  thumbnailShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3, 8, 18, 0.34)",
  },
  thumbnailBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(8, 145, 178, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  thumbnailBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  thumbnailBadgeText: {
    color: "#E0F2FE",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  scanLine: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#38BDF8",
    shadowColor: "#38BDF8",
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    color: "#BFDBFE",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 260,
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 18,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#38BDF8",
  },
});
