import Camera from "@/components/camera";
import { ThemedView } from "@/components/themed-view";
import { StyleSheet } from "react-native";

export default function CameraScreen() {
  return (
    <ThemedView style={styles.container}>
      <Camera />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
