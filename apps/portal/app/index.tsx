import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "@kiranalink/ui";

type Audience = "customer" | "retailer";

const appUrls: Record<Audience, string> = {
  customer: process.env.EXPO_PUBLIC_CUSTOMER_APP_URL ?? (__DEV__ ? "http://localhost:8082" : ""),
  retailer: process.env.EXPO_PUBLIC_RETAILER_APP_URL ?? (__DEV__ ? "http://localhost:8083" : ""),
};

const audienceContent = {
  customer: {
    icon: "basket-outline" as const,
    title: "Shop local",
    description: "Discover nearby stores, everyday essentials and group deals.",
    action: "Continue as customer",
    detail: "For people shopping in their neighbourhood",
  },
  retailer: {
    icon: "storefront-outline" as const,
    title: "Run your shop",
    description: "Manage your products, orders, stock and business growth.",
    action: "Continue as retailer",
    detail: "For shop owners and their teams",
  },
};

export default function PortalHome() {
  const { width } = useWindowDimensions();
  const [opening, setOpening] = useState<Audience | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isWide = width >= 720;

  const continueToApp = async (audience: Audience) => {
    setError(null);
    setOpening(audience);
    try {
      const url = appUrls[audience].trim();
      if (!url) {
        throw new Error(`The ${audience} app URL is not configured. Set EXPO_PUBLIC_${audience.toUpperCase()}_APP_URL before building the portal.`);
      }
      if (!/^https?:\/\/\S+$/i.test(url)) {
        throw new Error(`The ${audience} app URL is invalid. Check the portal's EXPO_PUBLIC_${audience.toUpperCase()}_APP_URL setting.`);
      }
      await Linking.openURL(url);
    } catch (openError) {
      setError(openError instanceof Error
        ? openError.message
        : "Could not open the selected app. Check its URL and make sure it is running.");
    } finally {
      setOpening(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="leaf" size={23} color={colors.lime} />
            </View>
            <View>
              <Text style={styles.brand}>KiranaLink</Text>
              <Text style={styles.brandSub}>LOCAL COMMERCE, CONNECTED</Text>
            </View>
          </View>

          <View style={styles.intro}>
            <View style={styles.eyebrowPill}>
              <View style={styles.onlineDot} />
              <Text style={styles.eyebrow}>WELCOME TO KIRANALINK</Text>
            </View>
            <Text style={styles.title}>How would you like to use KiranaLink?</Text>
            <Text style={styles.subtitle}>
              Choose your space to continue to the right sign-in page.
            </Text>
          </View>

          <View style={[styles.cards, isWide && styles.cardsWide]}>
            {(["customer", "retailer"] as const).map((audience) => {
              const content = audienceContent[audience];
              const isOpening = opening === audience;
              return (
                <Pressable
                  key={audience}
                  style={({ pressed }) => [
                    styles.card,
                    isWide && styles.cardWide,
                    pressed && styles.cardPressed,
                    opening && !isOpening && styles.cardDisabled,
                  ]}
                  onPress={() => void continueToApp(audience)}
                  disabled={opening !== null}
                  accessibilityRole="button"
                  accessibilityLabel={content.action}
                >
                  <View style={[styles.cardIcon, audience === "retailer" && styles.retailerIcon]}>
                    <Ionicons name={content.icon} size={24} color={colors.green} />
                  </View>
                  <Text style={styles.cardTitle}>{content.title}</Text>
                  <Text style={styles.cardDescription}>{content.description}</Text>
                  <Text style={styles.cardDetail}>{content.detail}</Text>
                  <View style={styles.cardAction}>
                    {isOpening
                      ? <ActivityIndicator size="small" color={colors.surface} />
                      : <Text style={styles.cardActionText}>{content.action}</Text>}
                    {!isOpening ? <Ionicons name="arrow-forward" size={17} color={colors.surface} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={17} color={colors.green} />
            <Text style={styles.securityText}>
              Secure sign-in happens in the app you choose. Your account stays yours.
            </Text>
          </View>
          <Text style={styles.footer}>KIRANALINK · YOUR NEIGHBOURHOOD, BETTER CONNECTED</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 22, paddingVertical: 28 },
  content: { width: "100%", maxWidth: 920, alignSelf: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 52 },
  brandIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.green, justifyContent: "center", alignItems: "center", marginRight: 12 },
  brand: { fontSize: 21, fontWeight: "900", color: colors.ink, letterSpacing: -0.7 },
  brandSub: { fontSize: 8, fontWeight: "800", letterSpacing: 1.1, color: colors.muted, marginTop: 2 },
  intro: { maxWidth: 600, marginBottom: 27 },
  eyebrowPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 15 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange, marginRight: 7 },
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1, color: colors.greenDark },
  title: { fontSize: 32, lineHeight: 39, fontWeight: "900", letterSpacing: -1, color: colors.ink, marginBottom: 9 },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted },
  cards: { gap: 14 },
  cardsWide: { flexDirection: "row" },
  card: { flex: 1, minHeight: 265, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 21 },
  cardWide: { maxWidth: 445 },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  cardDisabled: { opacity: 0.65 },
  cardIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", marginBottom: 17 },
  retailerIcon: { backgroundColor: "#FFF1E3" },
  cardTitle: { fontSize: 21, fontWeight: "900", letterSpacing: -0.5, color: colors.ink, marginBottom: 7 },
  cardDescription: { fontSize: 13, lineHeight: 19, color: colors.muted, marginBottom: 15 },
  cardDetail: { fontSize: 10, fontWeight: "700", color: colors.greenDark, marginBottom: 18 },
  cardAction: { minHeight: 45, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.green, borderRadius: 13, paddingHorizontal: 14, marginTop: "auto" },
  cardActionText: { color: colors.surface, fontSize: 12, fontWeight: "900" },
  error: { marginTop: 16, color: colors.red, fontSize: 12, lineHeight: 18 },
  securityNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 },
  securityText: { maxWidth: 440, textAlign: "center", color: colors.muted, fontSize: 11, lineHeight: 17 },
  footer: { textAlign: "center", color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1, marginTop: 24 },
});
