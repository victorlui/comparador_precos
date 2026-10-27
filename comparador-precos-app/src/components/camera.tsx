import { CameraView, useCameraPermissions } from "expo-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { router } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import {
  getScanProductErrorMessage,
  useScanProductMutation,
} from "@/hooks/mutations/use-scan-product-mutation";
import { setLatestScanResult } from "@/services/product-analysis/scan-result-store";

import { CameraLoadingOverlay } from "./camera-loading-overlay";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

const MAX_UPLOAD_WIDTH = 1280;
const UPLOAD_COMPRESSION = 0.55;
const CROP_WIDTH_RATIO = 0.7;
const CROP_HEIGHT_RATIO = 0.62;

async function optimizeCapturedPhotoAsync(photoUri: string) {
  const resizeContext = ImageManipulator.manipulate(photoUri);
  resizeContext.resize({ width: MAX_UPLOAD_WIDTH });

  const resizedImage = await resizeContext.renderAsync();
  const resizedResult = await resizedImage.saveAsync({
    compress: UPLOAD_COMPRESSION,
    format: SaveFormat.JPEG,
  });

  const cropWidth = Math.round(resizedResult.width * CROP_WIDTH_RATIO);
  const cropHeight = Math.round(resizedResult.height * CROP_HEIGHT_RATIO);
  const originX = Math.max(
    0,
    Math.round((resizedResult.width - cropWidth) / 2),
  );
  const originY = Math.max(
    0,
    Math.round((resizedResult.height - cropHeight) / 2),
  );

  const cropContext = ImageManipulator.manipulate(resizedResult.uri);
  cropContext.crop({
    originX,
    originY,
    width: cropWidth,
    height: cropHeight,
  });
  const croppedImage = await cropContext.renderAsync();

  return croppedImage.saveAsync({
    compress: UPLOAD_COMPRESSION,
    format: SaveFormat.JPEG,
  });
}

export default function Camera() {
  const facing: "front" | "back" = "back";
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<ComponentRef<typeof CameraView> | null>(null);
  const { mutateAsync: scanProduct, isPending: isAnalyzing } =
    useScanProductMutation();

  // 1. Verifica se o usuário permitiu o uso da câmera
  if (!permission) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Carregando permissões...</ThemedText>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.textCenter}>
          Precisamos de acesso à câmera para escanear o produto.
        </ThemedText>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <ThemedText style={styles.buttonText}>Conceder Permissão</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing || isAnalyzing) {
      return;
    }

    try {
      setIsCapturing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
      });

      if (!photo?.uri) {
        throw new Error("Não foi possível obter a imagem capturada.");
      }

      const optimizedPhoto = await optimizeCapturedPhotoAsync(photo.uri);

      setCapturedPhotoUri(optimizedPhoto.uri);
      setIsCapturing(false);

      const response = await scanProduct({ imageUri: optimizedPhoto.uri });
      setLatestScanResult(response, "camera");
      router.push("/results");
    } catch (error) {
      console.log("Erro ao capturar ou enviar foto:", { error });
      Alert.alert("Erro", getScanProductErrorMessage(error));
    } finally {
      setIsCapturing(false);
      setCapturedPhotoUri(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
      <CameraLoadingOverlay
        visible={isAnalyzing}
        photoUri={capturedPhotoUri}
        message="Identificando o produto e buscando as melhores ofertas."
      />

      <ThemedView style={styles.overlay}>
        <ThemedText style={styles.instructionText}>
          Centralize o produto dentro do enquadramento
        </ThemedText>

        <ThemedView style={styles.framingiContainer}>
          <ThemedView style={styles.framing} />
        </ThemedView>

        {isCapturing ? (
          <ActivityIndicator
            size="large"
            color="#ffffff"
            style={styles.loader}
          />
        ) : (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePicture}
            disabled={isAnalyzing}
          >
            <ThemedView style={styles.innerCaptureButton} />
          </TouchableOpacity>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  textCenter: {
    textAlign: "center",
    marginBottom: 20,
    fontSize: 16,
  },
  camera: {
    ...StyleSheet.absoluteFill,
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 50,
  },
  instructionText: {
    color: "#fff",
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 20,
  },
  framingiContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    backgroundColor: "transparent",
    padding: 20,
  },
  framing: {
    width: 340,
    height: 380,
    borderWidth: 4,
    borderColor: "#fff",
    borderStyle: "dashed",
    backgroundColor: "transparent",
    borderRadius: 24,
  },
  loader: {
    marginBottom: 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  innerCaptureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
