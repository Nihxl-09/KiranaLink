import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { createBackendClient } from "@kiranalink/backend";
import { colors, radius } from "@kiranalink/ui";

export default function RetailerAuthCallback() {
  const client = useMemo(() => createBackendClient(), []);
  const params = useLocalSearchParams<{ code?: string; flow?: string; error_description?: string }>();
  const code = typeof params.code === "string" ? params.code : null;
  const flow = typeof params.flow === "string" ? params.flow : "signup";
  const [loading, setLoading] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const exchangeRequest = useRef<ReturnType<typeof client.auth.exchangeCodeForSession> | null>(null);

  useEffect(() => {
    let active = true;
    if (!code) {
      setError(params.error_description ?? "This verification link is invalid or has expired. Request a new email and try again.");
      setLoading(false);
      return () => { active = false; };
    }

    exchangeRequest.current ??= client.auth.exchangeCodeForSession(code);
    exchangeRequest.current.then(({ error: exchangeError }) => {
      if (!active) return;
      if (exchangeError) {
        setError(exchangeError.message);
      } else if (flow === "recovery") {
        setRecoveryReady(true);
      } else {
        router.replace("/");
      }
      setLoading(false);
    }).catch((exchangeError: unknown) => {
      if (!active) return;
      setError(exchangeError instanceof Error ? exchangeError.message : "Could not verify this email.");
      setLoading(false);
    });

    return () => { active = false; };
  }, [client, code, flow, params.error_description]);

  const updatePassword = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.replace("/");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.subtitle}>Verifying your email securely…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name={error ? "alert-circle-outline" : "shield-checkmark-outline"} size={28} color={error ? colors.red : colors.green} /></View>
        <Text style={styles.title}>{recoveryReady ? "Choose a new password" : error ? "Link could not be verified" : "Email verified"}</Text>
        <Text style={styles.subtitle}>
          {recoveryReady ? "Use a strong password you have not used here before." : error ?? "Your account is ready. Continue to KiranaLink Business."}
        </Text>
        {recoveryReady ? (
          <>
            <TextInput style={styles.input} placeholder="New password (8+ characters)" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={colors.muted} value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry autoComplete="new-password" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.button} onPress={() => void updatePassword()} disabled={busy} accessibilityRole="button">
              {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Update password</Text>}
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.button} onPress={() => router.replace("/")} accessibilityRole="button">
            <Text style={styles.buttonText}>{error ? "Return to sign in" : "Continue"}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", padding: 22 },
  card: { width: "100%", maxWidth: 440, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 24 },
  icon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "900", marginBottom: 8 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10, marginBottom: 16 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13, color: colors.ink, marginBottom: 10 },
  error: { color: colors.red, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  button: { minHeight: 48, backgroundColor: colors.green, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 8 },
  buttonText: { color: colors.surface, fontWeight: "900", fontSize: 13 },
});
