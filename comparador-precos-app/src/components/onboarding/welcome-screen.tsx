import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type WelcomeScreenProps = {
  onComplete: () => void;
};

type WelcomeSlide = {
  id: string;
  title: string;
  description: string;
  helper: string;
  panelTitle: string;
  panelDescription: string;
  points: string[];
  accent: "blue" | "slate" | "amber";
};

const slides: WelcomeSlide[] = [
  {
    id: "scan",
    title: "Escaneie, compare e entenda o melhor preço sem perder tempo.",
    description:
      "Aponte a câmera para o produto e receba ofertas organizadas em segundos para decidir mais rápido.",
    helper: "Passo 1 de 3",
    panelTitle: "Busca visual imediata",
    panelDescription: "O app organiza o que importa para você decidir rápido.",
    points: [
      "Produto reconhecido com rapidez",
      "Ofertas organizadas por contexto",
      "Decisão mais clara na hora da compra",
    ],
    accent: "blue",
  },
  {
    id: "search",
    title: "Busque do seu jeito quando a foto não for a melhor entrada.",
    description:
      "Digite o nome do item e chegue direto nas ofertas quando você já souber o que quer procurar.",
    helper: "Passo 2 de 3",
    panelTitle: "Entrada flexível",
    panelDescription:
      "Foto e texto convivem no mesmo fluxo, sem atrito desnecessário.",
    points: [
      "Digite quando souber o nome",
      "Compare sem depender da câmera",
      "Continue a busca pelo caminho mais rápido",
    ],
    accent: "slate",
  },
  {
    id: "memory",
    title: "Junte tudo no mesmo lugar para voltar quando valer a pena.",
    description:
      "Salve favoritos, revise o histórico e retome comparações sem recomeçar a busca do zero.",
    helper: "Passo 3 de 3",
    panelTitle: "Contexto que fica com você",
    panelDescription:
      "Histórico e favoritos mantêm a comparação viva depois da primeira busca.",
    points: [
      "Favoritos prontos para acompanhar",
      "Histórico fácil de revisitar",
      "Menos retrabalho entre uma busca e outra",
    ],
    accent: "amber",
  },
];

const WelcomeScreen = ({ onComplete }: WelcomeScreenProps) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<WelcomeSlide> | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastSlide = currentIndex === slides.length - 1;
  const isCompactHeight = height < 780;
  const isVeryCompactHeight = height < 720;

  const footerCopy = useMemo(() => {
    if (isLastSlide) {
      return "Continue para acessar sua conta e começar sua primeira comparação.";
    }

    return "Leva poucos segundos para entender como o app trabalha por você.";
  }, [isLastSlide]);

  const handleMomentumEnd = (offsetX: number) => {
    const nextIndex = Math.round(offsetX / width);
    setCurrentIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
  };

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    handleMomentumEnd(event.nativeEvent.contentOffset.x);
  };

  const renderSlide = ({ item }: ListRenderItemInfo<WelcomeSlide>) => (
    <View style={[styles.slide, { width }]}>
      <View
        style={[styles.slideInner, isCompactHeight && styles.slideInnerCompact]}
      >
        <View
          style={[
            styles.copyBlock,
            isVeryCompactHeight && styles.copyBlockVeryCompact,
          ]}
        >
          <Text
            style={[
              styles.title,
              isCompactHeight && styles.titleCompact,
              isVeryCompactHeight && styles.titleVeryCompact,
            ]}
          >
            {item.title}
          </Text>
          <Text
            style={[
              styles.description,
              isVeryCompactHeight && styles.descriptionVeryCompact,
            ]}
          >
            {item.description}
          </Text>
        </View>
      </View>
    </View>
  );

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
      return;
    }

    const nextIndex = currentIndex + 1;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setCurrentIndex(nextIndex);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 14,
            paddingBottom: Math.max(insets.bottom, 18) + 18,
          },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pular introdução"
            accessibilityHint="Abre a tela de login sem continuar o carrossel"
            onPress={onComplete}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.skipButtonText}>Pular</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={slides}
          horizontal
          pagingEnabled
          bounces={false}
          decelerationRate="fast"
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          renderItem={renderSlide}
        />

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {slides.map((slide, index) => (
              <View
                key={slide.id}
                style={[styles.dot, index === currentIndex && styles.dotActive]}
              />
            ))}
          </View>

          <Text style={styles.footerText}>{footerCopy}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isLastSlide ? "Ir para a tela de login" : "Continuar onboarding"
            }
            accessibilityHint={
              isLastSlide
                ? "Finaliza a introdução e abre a autenticação"
                : "Avança para o próximo passo da introdução"
            }
            onPress={handleNext}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isLastSlide ? "Começar" : "Continuar"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FBFF",
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(32,138,239,0.16)",
  },
  backgroundOrbBottom: {
    position: "absolute",
    left: -90,
    bottom: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(111,194,255,0.18)",
  },
  content: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  brandBlock: {
    gap: 4,
  },
  brand: {
    color: "#0F172A",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  brandNote: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  skipButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(203,213,225,0.55)",
  },
  skipButtonText: {
    color: "#0F172A",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.8,
  },
  slide: {
    flex: 1,
  },
  slideInner: {
    paddingHorizontal: 20,
    justifyContent: "center",
    gap: 24,
    paddingBottom: 8,
  },
  slideInnerCompact: {
    gap: 18,
  },
  artFrame: {
    overflow: "hidden",
    borderRadius: 30,
  },
  artShell: {
    height: "100%",
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#EAF2FF",
    shadowColor: "rgba(15,23,42,0.18)",
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.16,
    shadowRadius: 36,
    elevation: 8,
  },
  artShellBlue: {
    backgroundColor: "#EAF2FF",
  },
  artShellSlate: {
    backgroundColor: "#EEF2F7",
  },
  artShellAmber: {
    backgroundColor: "#FFF3DF",
  },
  artOrbPrimary: {
    position: "absolute",
    top: 18,
    right: -10,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  artOrbSecondary: {
    position: "absolute",
    bottom: -18,
    left: -10,
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: "rgba(255,255,255,0.26)",
  },
  artPanel: {
    justifyContent: "center",
    padding: 22,
  },
  artBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  artBadge: {
    borderRadius: 999,
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  artBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  artBadgeMuted: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  artBadgeMutedText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  artHeadline: {
    gap: 8,
  },
  artTitle: {
    color: "#0F172A",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  artDescription: {
    color: "#526174",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    maxWidth: 300,
  },
  artList: {
    gap: 10,
  },
  artRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  artRowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0F172A",
  },
  artRowText: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
  copyBlock: {
    gap: 12,
    paddingRight: 10,
  },
  copyBlockVeryCompact: {
    gap: 8,
  },
  title: {
    color: "#0F172A",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 33,
  },
  titleVeryCompact: {
    fontSize: 25,
    lineHeight: 30,
  },
  description: {
    color: "#5B677A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    maxWidth: 340,
    flexShrink: 1,
  },
  descriptionVeryCompact: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(100,116,139,0.24)",
  },
  dotActive: {
    width: 24,
    backgroundColor: "#0F172A",
  },
  footerText: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 18,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    shadowColor: "rgba(15,23,42,0.24)",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
});
