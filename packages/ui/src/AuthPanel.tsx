import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "./tokens";
import { kiranaLinkLogo } from "./brand";

type AuthPanelProps = {
  audience: "customer" | "retailer";
  statusMessage?: string | null;
  onSubmit: (mode: "sign-in" | "sign-up", email: string, password: string, fullName: string) => Promise<void>;
  onRecoverPassword: (email: string) => Promise<void>;
};

export function AuthPanel({ audience, onSubmit, onRecoverPassword, statusMessage }: AuthPanelProps) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setSuccessMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Email is invalid. Check the address and try again.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    if (mode === "sign-up" && !fullName.trim()) {
      setError("Enter your name to create an account.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      await onSubmit(mode, normalizedEmail, password, fullName.trim());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const recoverPassword = async () => {
    setError(null);
    setSuccessMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Email is invalid. Check the address and try again.");
      return;
    }

    setBusy(true);
    try {
      await onRecoverPassword(normalizedEmail);
      setSuccessMessage("If an account matches this email, password reset instructions will arrive shortly.");
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : "Could not request a password reset.");
    } finally {
      setBusy(false);
    }
  };

  const audienceTitle = audience === "customer" ? "Shop local, live better." : "Your shop, in control.";

  return (
    <KeyboardAvoidingView style={styles.keyboardScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Image
            source={kiranaLinkLogo}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="KiranaLink logo"
          />
          <Text style={styles.brandSub}>{audience === "customer" ? "NEIGHBOURHOOD SHOPPING" : "RETAILER WORKSPACE"}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.eyebrowPill}><View style={styles.onlineDot} /><Text style={styles.eyebrow}>{audience === "customer" ? "YOUR LOCAL MARKETPLACE" : "BUSINESS ACCOUNT"}</Text></View>
          <Text style={styles.title}>{mode === "sign-in" ? audienceTitle : "Let’s get you started."}</Text>
          <Text style={styles.subtitle}>
            {mode === "sign-in"
              ? audience === "customer"
                ? "Discover trusted shops and everyday essentials nearby."
                : "Manage your products, stock and orders in one place."
              : audience === "customer"
                ? "Create your account to save addresses and track orders."
                : "Create your account, then add your shop details."}
          </Text>

          {mode === "sign-up" ? (
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={colors.muted} />
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={colors.muted}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                returnKeyType="next"
                accessibilityLabel="Full name"
              />
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18} color={colors.muted} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              accessibilityLabel="Email address"
            />
          </View>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
            <TextInput
              style={styles.input}
              placeholder="Password (8+ characters)"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete={mode === "sign-up" ? "new-password" : "password"}
              secureTextEntry={!passwordVisible}
              textContentType={mode === "sign-up" ? "newPassword" : "password"}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="Password"
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setPasswordVisible((visible) => !visible)}
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            >
              <Ionicons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={19} color={colors.muted} />
            </Pressable>
          </View>

          {mode === "sign-in" ? (
            <Pressable
              style={styles.recoveryAction}
              onPress={() => void recoverPassword()}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.recoveryText}>Forgot password?</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
          {successMessage ? <Text style={styles.status}>{successMessage}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, busy && styles.disabled]}
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.submitText}>{mode === "sign-in" ? "Sign in" : "Create account"}</Text>}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{mode === "sign-in" ? "New to KiranaLink?" : "Already have an account?"}</Text>
            <Pressable
              onPress={() => {
                setError(null);
                setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
              }}
              accessibilityRole="button"
            >
              <Text style={styles.switchAction}>{mode === "sign-in" ? " Create account" : " Sign in"}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>SECURE SIGN-IN · YOUR DATA STAYS YOURS</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function isValidEmail(email: string): boolean {
  const match = /^([a-z0-9.!#$%&'*+/=?^_`{|}~-]+)@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/i.exec(email);
  if (!match || email.length > 254) return false;
  const localPart = match[1];
  return !localPart.startsWith(".") && !localPart.endsWith(".") && !localPart.includes("..");
}

const styles = StyleSheet.create({
  keyboardScreen: { flex: 1, backgroundColor: colors.paper },
  screen: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, paddingVertical: 28 },
  brandRow: { width: "100%", maxWidth: 520, alignItems: "center", marginBottom: 18 },
  brandLogo: { width: 180, height: 180 },
  brandSub: { fontSize: 8, fontWeight: "800", letterSpacing: 1.1, color: colors.muted, marginTop: -4 },
  card: { width: "100%", maxWidth: 520, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 24, padding: 21 },
  eyebrowPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 15 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange, marginRight: 7 },
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1, color: colors.greenDark },
  title: { fontSize: 25, lineHeight: 31, fontWeight: "900", letterSpacing: -0.8, color: colors.ink, marginBottom: 7 },
  subtitle: { fontSize: 12, lineHeight: 18, color: colors.muted, marginBottom: 20 },
  inputRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: "#FBFCFA", paddingHorizontal: 13, marginBottom: 10 },
  input: { flex: 1, minHeight: 48, paddingVertical: 8, fontSize: 13, color: colors.ink },
  passwordToggle: { minWidth: 30, minHeight: 42, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 11, lineHeight: 16, color: colors.red, marginBottom: 10 },
  status: { fontSize: 11, lineHeight: 16, color: colors.green, marginBottom: 10 },
  recoveryAction: { alignSelf: "flex-end", paddingVertical: 5, marginTop: -4, marginBottom: 6 },
  recoveryText: { color: colors.green, fontSize: 11, fontWeight: "800" },
  submitButton: { height: 48, backgroundColor: colors.green, borderRadius: 14, justifyContent: "center", alignItems: "center", marginTop: 4 },
  submitText: { color: colors.surface, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.78 },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 17 },
  switchText: { color: colors.muted, fontSize: 11 },
  switchAction: { color: colors.green, fontWeight: "900", fontSize: 11 },
  footer: { width: "100%", maxWidth: 520, textAlign: "center", color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1, marginTop: 21 },
});
