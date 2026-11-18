import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@kiranalink/ui";

export default function CustomerNotFound() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name="compass-outline" size={30} color={colors.green} /></View>
        <Text style={styles.code}>404 · PAGE NOT FOUND</Text>
        <Text style={styles.title}>This page isn’t on the map.</Text>
        <Text style={styles.body}>The link may be incorrect or the page may have moved. Head back to local shops.</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/")} accessibilityRole="button">
          <Ionicons name="storefront-outline" size={18} color={colors.surface} />
          <Text style={styles.buttonText}>Go to shops</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", padding: 22 },
  card: { width: "100%", maxWidth: 440, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 24, alignItems: "flex-start" },
  icon: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  code: { color: colors.green, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 9 },
  title: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900", marginBottom: 8 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  button: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.green, borderRadius: 13, paddingHorizontal: 16 },
  buttonText: { color: colors.surface, fontSize: 12, fontWeight: "900" },
});
