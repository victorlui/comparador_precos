import type { ReactNode } from "react";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

type HomeAnimatedStageProps = {
  variant: "header" | "hero" | "search" | "history";
  children: ReactNode;
};

function getEnteringAnimation(variant: HomeAnimatedStageProps["variant"]) {
  switch (variant) {
    case "header":
      return FadeInDown.duration(420);
    case "hero":
      return FadeInUp.delay(70).duration(460);
    case "search":
      return FadeInUp.delay(120).duration(460);
    case "history":
      return FadeInUp.delay(180).duration(500);
  }
}

export function HomeAnimatedStage({
  variant,
  children,
}: HomeAnimatedStageProps) {
  return <Animated.View entering={getEnteringAnimation(variant)}>{children}</Animated.View>;
}
