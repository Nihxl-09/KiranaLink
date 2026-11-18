import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "./tokens";

type BackendSetupNoticeProps = {
  audience: "customer" | "retailer";
};

export function BackendSetupNotice({ audience }: BackendSetupNoticeProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.icon}><Text style={styles.iconText}>K</Text></View>
        <Text style={styles.eyebrow}>ONE-TIME CONNECTION</Text>
        <Text style={styles.title}>Connect your KiranaLink backend</Text>
        <Text style={styles.body}>
          {audience === "customer"
            ? "Shopping, orders and account data need your Supabase project before they can go live."
            : "Shop setup, products and order management need your Supabase project before they can go live."}
        </Text>
        <View style={styles.steps}>
          <Text style={styles.step}>1. Create a Supabase project and apply migrations 0001 and 0002.</Text>
          <Text style={styles.step}>2. Copy this app’s .env.example to .env.</Text>
          <Text style={styles.step}>3. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.</Text>
        </View>
        <Text style={styles.warning}>Never put a service-role key in the mobile app.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", backgroundColor: colors.paper, padding: 22 },
  card: { backgroundColor: colors.surface, borderRadius: 23, borderWidth: 1, borderColor: colors.line, padding: 22 },
  icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.green, justifyContent: "center", alignItems: "center", marginBottom: 17 },
  iconText: { color: colors.lime, fontSize: 22, fontWeight: "900" },
  eyebrow: { color: colors.orange, fontSize: 8, fontWeight: "900", letterSpacing: 1.1, marginBottom: 9 },
  title: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 },
  body: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 17 },
  steps: { backgroundColor: colors.greenSoft, borderRadius: radius.md, padding: 13, gap: 9 },
  step: { color: colors.ink, fontSize: 11, lineHeight: 16 },
  warning: { color: colors.red, fontSize: 10, lineHeight: 15, fontWeight: "700", marginTop: 14 },
});
