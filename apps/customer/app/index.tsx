import React, { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  addItemToCart,
  BackendClient,
  CartItem,
  CatalogItem,
  changeOrderStatus,
  checkoutCart,
  createBackendClient,
  createSupportTicket,
  getActiveCategories,
  getActiveShops,
  getCustomerAddresses,
  getCustomerCart,
  getCustomerOrders,
  getOrderStatusHistory,
  getSupportMessages,
  getSupportTickets,
  getShopCatalog,
  isBackendConfigured,
  OrderWithItems,
  OrderStatusHistory,
  ProductPoolListing,
  ShopAdListing,
  saveCustomerAddress,
  Session,
  setCartItemQuantity,
  replyToSupportTicket,
  registerExpoPushToken,
  submitUpiPayment,
  getActiveAdCampaigns,
  getOpenProductPools,
  joinProductPool,
  leaveProductPool,
} from "@kiranalink/backend";
import { AuthPanel, BackendSetupNotice, colors, radius } from "@kiranalink/ui";

type Shop = Awaited<ReturnType<typeof getActiveShops>>[number];
type Category = Awaited<ReturnType<typeof getActiveCategories>>[number];
type Address = Awaited<ReturnType<typeof getCustomerAddresses>>[number];
type SupportTicket = Awaited<ReturnType<typeof getSupportTickets>>[number];
type Tab = "shops" | "pools" | "cart" | "orders" | "account";

const money = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function CustomerHome() {
  if (!isBackendConfigured()) return <BackendSetupNotice audience="customer" />;
  return <ConnectedCustomerApp />;
}

function ConnectedCustomerApp() {
  const client = useMemo(() => createBackendClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("shops");
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeAds, setActiveAds] = useState<ShopAdListing[]>([]);
  const [productPools, setProductPools] = useState<ProductPoolListing[]>([]);
  const [poolQuantities, setPoolQuantities] = useState<Record<string, string>>({});
  const [poolFulfillment, setPoolFulfillment] = useState<Record<string, "pickup" | "delivery">>({});
  const [poolPaymentMethod, setPoolPaymentMethod] = useState<Record<string, "cash" | "upi">>({});
  const [poolAddressIds, setPoolAddressIds] = useState<Record<string, string | null>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderStatusHistory[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [supportMessages, setSupportMessages] = useState<Awaited<ReturnType<typeof getSupportMessages>>>([]);
  const [supportReply, setSupportReply] = useState("");
  const [search, setSearch] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [addressName, setAddressName] = useState("");
  const [addressPhone, setAddressPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [supportOrderId, setSupportOrderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setAuthLoading(false);
    }).catch((sessionError: unknown) => {
      if (active) {
        setError(messageOf(sessionError));
        setAuthLoading(false);
      }
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      setAuthNotice(null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    registerExpoPushToken(client).then((pushStatus) => {
      if (!active) return;
      const notices = {
        registered: "Order notifications are enabled on this device.",
        web: "Remote push notifications require the installed mobile app.",
        "expo-go": "Remote push notifications need an installed development build; Expo Go does not support them.",
        "missing-project-id": "Push setup is incomplete. Initialize EAS for the Customer app, then install its development build.",
        "permission-denied": "Notifications are turned off for KiranaLink. Enable them in your device settings to receive order updates.",
      };
      setStatusMessage(notices[pushStatus]);
    }).catch((pushError: unknown) => {
      if (active) setError(`Push notifications could not be enabled: ${messageOf(pushError)}`);
    });
    return () => { active = false; };
  }, [client, session]);

  useEffect(() => {
    if (!session) {
      setShops([]);
      setActiveAds([]);
      setProductPools([]);
      setSelectedShop(null);
      setCategories([]);
      setCatalog([]);
      setCart([]);
      setCartId(null);
      setOrders([]);
      setOrderHistory([]);
      setSupportTickets([]);
      setSelectedTicketId(null);
      setSupportMessages([]);
      setAddresses([]);
      return;
    }
    let active = true;
    setBusy(true);
    Promise.all([
      getActiveShops(client),
      getActiveCategories(client),
      getCustomerAddresses(client, session.user.id),
      getCustomerOrders(client, session.user.id),
      getSupportTickets(client, { customerId: session.user.id }),
      getActiveAdCampaigns(client),
      getOpenProductPools(client, session.user.id),
    ]).then(async ([nextShops, nextCategories, nextAddresses, nextOrders, nextTickets, nextAds, nextPools]) => {
      if (!active) return;
      const nextHistory = await getOrderStatusHistory(client, nextOrders.map((order) => order.id));
      if (!active) return;
      setShops(nextShops);
      setActiveAds(nextAds);
      setProductPools(nextPools);
      setPoolQuantities(Object.fromEntries(nextPools.map(({ pool, contribution }) => [
        pool.id,
        String(contribution?.quantity ?? 1),
      ])));
      setPoolFulfillment(Object.fromEntries(nextPools.map(({ pool, shop }) => [
        pool.id,
        shop?.pickup_enabled ? "pickup" : "delivery",
      ])));
      setPoolPaymentMethod(Object.fromEntries(nextPools.map(({ pool }) => [pool.id, "cash"])));
      setPoolAddressIds(Object.fromEntries(nextPools.map(({ pool }) => [
        pool.id,
        nextAddresses.find((address) => address.is_default)?.id ?? nextAddresses[0]?.id ?? null,
      ])));
      setCategories(nextCategories);
      setAddresses(nextAddresses);
      setSelectedAddressId(nextAddresses.find((address) => address.is_default)?.id ?? nextAddresses[0]?.id ?? null);
      setOrders(nextOrders);
      setOrderHistory(nextHistory);
      setSupportTickets(nextTickets);
      setError(null);
    }).catch((loadError: unknown) => {
      if (active) setError(messageOf(loadError));
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [client, session]);

  useEffect(() => {
    if (!selectedTicketId) {
      setSupportMessages([]);
      return;
    }
    let active = true;
    getSupportMessages(client, selectedTicketId).then((rows) => {
      if (active) setSupportMessages(rows);
    }).catch((loadError: unknown) => {
      if (active) setError(messageOf(loadError));
    });
    return () => { active = false; };
  }, [client, selectedTicketId]);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setStatusMessage(null);
    setBusy(true);
    try {
      await action();
    } catch (actionError) {
      setError(messageOf(actionError));
    } finally {
      setBusy(false);
    }
  };

  const loadShop = async (shop: Shop) => {
    await run(async () => {
      const [nextCatalog, nextCart] = await Promise.all([
        getShopCatalog(client, shop.id),
        getCustomerCart(client, session!.user.id, shop.id),
      ]);
      setSelectedShop(shop);
      setCatalog(nextCatalog);
      setCartId(nextCart.cartId);
      setCart(nextCart.items);
      setSelectedCategoryId(null);
      setFulfillment(shop.pickup_enabled ? "pickup" : "delivery");
      setPaymentMethod("cash");
      setSearch("");
      setTab("shops");
    });
  };

  const refreshCart = async () => {
    if (!session || !selectedShop) return;
    const nextCart = await getCustomerCart(client, session.user.id, selectedShop.id);
    setCartId(nextCart.cartId);
    setCart(nextCart.items);
  };

  const refreshOrders = async () => {
    if (!session) return;
    const nextOrders = await getCustomerOrders(client, session.user.id);
    const nextHistory = await getOrderStatusHistory(client, nextOrders.map((order) => order.id));
    setOrders(nextOrders);
    setOrderHistory(nextHistory);
  };

  const refreshPools = async () => {
    if (!session) return;
    const nextPools = await getOpenProductPools(client, session.user.id);
    setProductPools(nextPools);
    setPoolQuantities((current) => Object.fromEntries(nextPools.map(({ pool, contribution }) => [
      pool.id,
      current[pool.id] ?? String(contribution?.quantity ?? 1),
    ])));
  };

  const reservePoolUnits = async (listing: ProductPoolListing) => {
    const quantity = Number(poolQuantities[listing.pool.id] ?? "1");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a positive quantity for the pool.");
      return;
    }
    const fulfillmentType = poolFulfillment[listing.pool.id]
      ?? (listing.shop?.pickup_enabled ? "pickup" : "delivery");
    const payment = poolPaymentMethod[listing.pool.id] ?? "cash";
    const addressId = poolAddressIds[listing.pool.id] ?? selectedAddressId;
    if (fulfillmentType === "delivery" && !addressId) {
      setError("Save or select a delivery address in the Cart tab before joining this pool.");
      return;
    }
    if (payment === "upi" && !listing.shop?.upi_id) {
      setError("This shop has not configured UPI payments. Choose cash or contact the shop.");
      return;
    }
    await run(async () => {
      const orderId = await joinProductPool(client, {
        poolId: listing.pool.id,
        quantity,
        fulfillmentType,
        addressId: fulfillmentType === "delivery" ? addressId : null,
        paymentMethod: payment,
      });
      await refreshPools();
      if (orderId) {
        await refreshOrders();
        setStatusMessage("The target was reached. Your pooled order is in Orders; payment is due using your selected method.");
        setTab("orders");
      } else {
        setStatusMessage("Reservation saved. No payment is collected now; an order is created only if the pool reaches its target before the deadline.");
      }
    });
  };

  const withdrawFromPool = async (poolId: string) => {
    await run(async () => {
      await leaveProductPool(client, poolId);
      await refreshPools();
      setStatusMessage("Your reservation was removed. The pool total has been updated.");
    });
  };

  const handleAuth = async (
    mode: "sign-in" | "sign-up",
    email: string,
    password: string,
    fullName: string,
  ) => {
    setAuthNotice(null);
    if (mode === "sign-in") {
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      return;
    }
    const { data, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: Linking.createURL("auth/callback"),
      },
    });
    if (signUpError) throw signUpError;
    if (!data.session) {
      setAuthNotice("Check your email to confirm your account, then sign in.");
    }
  };

  const handlePasswordRecovery = async (email: string) => {
    const { error: recoveryError } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL("auth/callback", { queryParams: { flow: "recovery" } }),
    });
    if (recoveryError) throw recoveryError;
  };

  const addToCart = async (item: CatalogItem) => {
    await run(async () => {
      await addItemToCart(client, item.inventory.shop_id, item.inventory.id);
      const next = await getCustomerCart(client, session!.user.id, item.inventory.shop_id);
      setSelectedShop(shops.find((shop) => shop.id === item.inventory.shop_id) ?? selectedShop);
      setCartId(next.cartId);
      setCart(next.items);
    });
  };

  const updateQuantity = async (item: CartItem, change: number) => {
    await run(async () => {
      await setCartItemQuantity(client, item.id, Math.max(0, item.quantity + change));
      await refreshCart();
    });
  };

  const addAddress = async () => {
    if (!session) return;
    if (!addressName.trim() || !addressPhone.trim() || !addressLine.trim() || !addressCity.trim() || !addressState.trim()) {
      setError("Complete the recipient, phone, street address, city and state fields.");
      return;
    }
    await run(async () => {
      const address = await saveCustomerAddress(client, {
        customer_id: session.user.id,
        label: "Delivery",
        recipient_name: addressName.trim(),
        phone: addressPhone.trim(),
        address_line: addressLine.trim(),
        locality: null,
        city: addressCity.trim(),
        state: addressState.trim(),
        postal_code: null,
        is_default: addresses.length === 0,
      });
      const next = await getCustomerAddresses(client, session.user.id);
      setAddresses(next);
      setSelectedAddressId(address.id);
    });
  };

  const placeOrder = async () => {
    if (!cartId || cart.length === 0) {
      setError("Add items to your cart before checking out.");
      return;
    }
    if (fulfillment === "delivery" && !selectedAddressId) {
      setError("Save a delivery address before placing a delivery order.");
      return;
    }
    if (paymentMethod === "upi" && !selectedShop?.upi_id) {
      setError("This shop has not configured a UPI ID. Choose cash or contact the shop.");
      return;
    }
    await run(async () => {
      await checkoutCart(client, cartId, fulfillment, paymentMethod, selectedAddressId ?? undefined);
      await refreshCart();
      await refreshOrders();
      setTab("orders");
    });
  };

  const submitPaymentReference = async (order: OrderWithItems) => {
    const reference = paymentReferences[order.id]?.trim();
    if (!reference) {
      setError("Enter the UPI transaction reference.");
      return;
    }
    await run(async () => {
      await submitUpiPayment(client, order.id, reference);
      setPaymentReferences((current) => ({ ...current, [order.id]: "" }));
      await refreshOrders();
    });
  };

  const submitTicket = async () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      setError("Enter a subject and message for support.");
      return;
    }
    await run(async () => {
      await createSupportTicket(client, ticketSubject.trim(), ticketMessage.trim(), supportOrderId ?? undefined);
      setTicketSubject("");
      setTicketMessage("");
      setSupportOrderId(null);
      setSupportTickets(await getSupportTickets(client, { customerId: session!.user.id }));
      setStatusMessage("Your support request has been sent. Follow replies below.");
    });
  };

  const sendSupportReply = async () => {
    if (!selectedTicketId || !supportReply.trim()) {
      setError("Write a reply before sending.");
      return;
    }
    await run(async () => {
      await replyToSupportTicket(client, selectedTicketId, supportReply.trim());
      setSupportReply("");
      setSupportMessages(await getSupportMessages(client, selectedTicketId));
      setSupportTickets(await getSupportTickets(client, { customerId: session!.user.id }));
    });
  };

  if (authLoading) return <LoadingScreen />;
  if (!session) {
    return (
      <AuthPanel
        audience="customer"
        statusMessage={authNotice}
        onSubmit={handleAuth}
        onRecoverPassword={handlePasswordRecovery}
      />
    );
  }

  const filteredCatalog = catalog.filter((item) => {
    const searchable = `${item.product.name} ${item.product.brand ?? ""} ${item.product.description ?? ""}`;
    return searchable.toLowerCase().includes(search.trim().toLowerCase())
      && (!selectedCategoryId || item.product.category_id === selectedCategoryId);
  });
  const cartTotal = cart.reduce(
    (total, item) => total + Math.round(item.inventory.selling_price_paise * item.quantity),
    0,
  );
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.topEyebrow}>KIRANALINK CUSTOMER</Text>
          <Text style={styles.topTitle}>{tab === "shops" ? "Shop local" : tab === "pools" ? "Pool & save" : tab === "cart" ? "Your cart" : tab === "orders" ? "Your orders" : "Your account"}</Text>
        </View>
        <Pressable style={styles.avatar} onPress={() => setTab("account")} accessibilityRole="button">
          <Text style={styles.avatarText}>{session.user.email?.slice(0, 1).toUpperCase() ?? "K"}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {statusMessage ? <Text style={styles.successBanner}>{statusMessage}</Text> : null}
      {busy ? <ActivityIndicator style={styles.loader} color={colors.green} /> : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tab === "shops" ? (
          selectedShop ? (
            <View>
              <Pressable style={styles.backButton} onPress={() => setSelectedShop(null)} accessibilityRole="button">
                <Text style={styles.backText}>‹  All neighbourhood shops</Text>
              </Pressable>
              <View style={styles.shopHero}>
                <Text style={styles.shopEyebrow}>LOCAL SHOP</Text>
                <Text style={styles.shopTitle}>{selectedShop.name}</Text>
                <Text style={styles.shopMeta}>{selectedShop.locality ? `${selectedShop.locality}, ` : ""}{selectedShop.city}</Text>
                <Text style={styles.shopDescription}>{selectedShop.description || "A local shop ready to serve your neighbourhood."}</Text>
              </View>
              <TextInput
                style={styles.search}
                placeholder="Search products in this shop"
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
                accessibilityLabel="Search products"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFilters}>
                <Pressable
                  style={[styles.categoryChip, !selectedCategoryId && styles.categoryChipSelected]}
                  onPress={() => setSelectedCategoryId(null)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.categoryChipText, !selectedCategoryId && styles.categoryChipTextSelected]}>All products</Text>
                </Pressable>
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    style={[styles.categoryChip, selectedCategoryId === category.id && styles.categoryChipSelected]}
                    onPress={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.categoryChipText, selectedCategoryId === category.id && styles.categoryChipTextSelected]}>{category.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {filteredCatalog.map((item) => (
                <View key={item.inventory.id} style={styles.productCard}>
                  {item.product.image_path ? (
                    <Image source={{ uri: client.storage.from("product-images").getPublicUrl(item.product.image_path).data.publicUrl }} style={styles.productMark} />
                  ) : (
                    <View style={styles.productMark}><Ionicons name="leaf-outline" size={20} color={colors.amber} /></View>
                  )}
                  <View style={styles.productCopy}>
                    <View style={styles.productTitleRow}>
                      <Text style={styles.productName}>{item.product.name}</Text>
                      {activeAds.some((ad) =>
                        ad.campaign.target_type === "product"
                        && ad.campaign.shop_id === selectedShop.id
                        && ad.campaign.product_id === item.product.id
                      ) ? <Text style={styles.sponsoredBadge}>Sponsored</Text> : null}
                    </View>
                    <Text style={styles.productMeta}>{item.product.brand ? `${item.product.brand} · ` : ""}{item.product.unit_label} · {item.inventory.available_quantity} available</Text>
                  </View>
                  <View style={styles.productAction}>
                    <Text style={styles.price}>{money(item.inventory.selling_price_paise)}</Text>
                    <Pressable style={styles.smallButton} onPress={() => void addToCart(item)} disabled={busy} accessibilityRole="button">
                      <Text style={styles.smallButtonText}>Add</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {filteredCatalog.length === 0 ? <EmptyState title="No products found" body="Try another search or check back later." /> : null}
            </View>
          ) : (
            <View>
              <View style={styles.welcome}>
                <Text style={styles.welcomeKicker}>THE GOOD STUFF IS CLOSE</Text>
                <Text style={styles.welcomeTitle}>Your trusted neighbourhood shops.</Text>
                <Text style={styles.welcomeBody}>Browse real catalogues, compare availability and order directly from local stores.</Text>
              </View>
              <Text style={styles.sectionTitle}>Shops near you</Text>
              {shops.map((shop) => (
                <Pressable
                  key={shop.id}
                  style={styles.shopCard}
                  onPress={() => void loadShop(shop)}
                  accessibilityRole="button"
                >
                  <View style={styles.shopIcon}><Text style={styles.shopIconText}>{shop.name.slice(0, 1).toUpperCase()}</Text></View>
                  <View style={styles.shopCopy}>
                    <Text style={styles.shopName}>{shop.name}</Text>
                    {activeAds.some((ad) => ad.campaign.target_type === "store" && ad.campaign.shop_id === shop.id)
                      ? <Text style={styles.sponsoredBadge}>Sponsored placement</Text>
                      : null}
                    <Text style={styles.shopMeta}>{shop.locality ? `${shop.locality}, ` : ""}{shop.city}, {shop.state}</Text>
                    <Text style={styles.shopServices}>{shop.pickup_enabled ? "Pickup" : ""}{shop.pickup_enabled && shop.delivery_enabled ? " · " : ""}{shop.delivery_enabled ? "Delivery" : ""}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
              {shops.length === 0 ? <EmptyState title="No shops available yet" body="Published local shops and their real products will appear here when available." /> : null}
            </View>
          )
        ) : null}

        {tab === "pools" ? (
          <View>
            <View style={styles.poolIntro}>
              <Text style={styles.welcomeKicker}>BUY TOGETHER, SAVE TOGETHER</Text>
              <Text style={styles.welcomeTitle}>Reach the target as a group.</Text>
              <Text style={styles.welcomeBody}>Reserve a quantity at the pooled price. No payment is taken while the pool is open. If the target is reached in time, an order is created for each participant and paid using the selected shop payment method. If it is not reached, the reservation expires with no order or charge.</Text>
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Open product pools</Text>
              <Pressable onPress={() => void run(refreshPools)} disabled={busy} accessibilityRole="button">
                <Text style={styles.linkText}>Refresh</Text>
              </Pressable>
            </View>
            {productPools.map((listing) => {
              const { pool, shop, product, contribution } = listing;
              if (!shop) return null;
              const fulfillmentType = poolFulfillment[pool.id] ?? (shop.pickup_enabled ? "pickup" : "delivery");
              const payment = poolPaymentMethod[pool.id] ?? "cash";
              const addressId = poolAddressIds[pool.id] ?? selectedAddressId;
              const progress = Math.min(100, (pool.joined_quantity / pool.target_quantity) * 100);
              const poolName = product?.name ?? pool.product_name_snapshot;
              return (
                <View key={pool.id} style={styles.poolCard}>
                  <View style={styles.poolCardTop}>
                    <View style={styles.poolProductIcon}>
                      <Ionicons name="people-outline" size={21} color={colors.green} />
                    </View>
                    <View style={styles.productCopy}>
                      <Text style={styles.productName}>{poolName}</Text>
                      <Text style={styles.productMeta}>{shop.name} · {shop.city}</Text>
                    </View>
                    <Text style={styles.poolStatus}>{contribution?.status === "joined" ? "RESERVED" : "OPEN"}</Text>
                  </View>
                  <View style={styles.poolPriceRow}>
                    <Text style={styles.poolPrice}>{money(pool.pool_unit_price_paise)} / {pool.unit_label_snapshot}</Text>
                    <Text style={styles.poolWasPrice}>Regular {money(pool.regular_unit_price_paise)}</Text>
                  </View>
                  <View style={styles.poolProgressText}>
                    <Text style={styles.poolDetail}>{pool.joined_quantity} of {pool.target_quantity} units reserved</Text>
                    <Text style={styles.poolDetail}>Closes {new Date(pool.ends_at).toLocaleString()}</Text>
                  </View>
                  <View style={styles.poolProgressTrack}>
                    <View style={[styles.poolProgressFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.formLabel}>Your quantity ({pool.unit_label_snapshot})</Text>
                  <TextInput
                    style={styles.input}
                    value={poolQuantities[pool.id] ?? "1"}
                    onChangeText={(value) => setPoolQuantities((current) => ({ ...current, [pool.id]: value }))}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`Quantity for ${poolName} pool`}
                  />
                  <Text style={styles.formLabel}>Fulfilment</Text>
                  <View style={styles.choiceRow}>
                    {(["pickup", "delivery"] as const).map((value) => {
                      const enabled = value === "pickup" ? shop.pickup_enabled : shop.delivery_enabled;
                      return (
                        <Pressable
                          key={value}
                          style={[styles.choice, fulfillmentType === value && styles.choiceSelected, !enabled && styles.choiceDisabled]}
                          onPress={() => enabled && setPoolFulfillment((current) => ({ ...current, [pool.id]: value }))}
                          disabled={!enabled}
                          accessibilityRole="button"
                        >
                          <Text style={[styles.choiceText, fulfillmentType === value && styles.choiceTextSelected]}>{value === "pickup" ? "Pickup" : "Delivery"}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {fulfillmentType === "delivery" ? (
                    <View style={styles.poolAddresses}>
                      {addresses.map((address) => (
                        <Pressable
                          key={address.id}
                          style={[styles.addressChoice, addressId === address.id && styles.addressSelected]}
                          onPress={() => setPoolAddressIds((current) => ({ ...current, [pool.id]: address.id }))}
                          accessibilityRole="button"
                        >
                          <Text style={styles.addressName}>{address.label || address.recipient_name}</Text>
                          <Text style={styles.addressDetail}>{address.address_line}, {address.city}</Text>
                        </Pressable>
                      ))}
                      {addresses.length === 0 ? <Text style={styles.poolDetail}>Add a delivery address from the Cart tab first.</Text> : null}
                    </View>
                  ) : null}
                  <Text style={styles.formLabel}>Pay after the target is reached</Text>
                  <View style={styles.choiceRow}>
                    {(["cash", "upi"] as const).map((value) => {
                      const unavailable = value === "upi" && !shop.upi_id;
                      return (
                        <Pressable
                          key={value}
                          style={[styles.choice, payment === value && styles.choiceSelected, unavailable && styles.choiceDisabled]}
                          onPress={() => !unavailable && setPoolPaymentMethod((current) => ({ ...current, [pool.id]: value }))}
                          disabled={unavailable}
                          accessibilityRole="button"
                        >
                          <Text style={[styles.choiceText, payment === value && styles.choiceTextSelected]}>
                            {value === "cash" ? "Cash at shop" : unavailable ? "UPI not set up" : "UPI transfer"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => void reservePoolUnits(listing)}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryButtonText}>{contribution?.status === "joined" ? "Update reservation" : "Join pool"}</Text>
                  </Pressable>
                  {contribution?.status === "joined" ? (
                    <Pressable style={styles.cancelButton} onPress={() => void withdrawFromPool(pool.id)} disabled={busy} accessibilityRole="button">
                      <Text style={styles.cancelText}>Leave this pool</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {productPools.length === 0 ? (
              <EmptyState title="No open pools right now" body="Check back soon for local group-buy offers. Expired pools close without taking payment." />
            ) : null}
          </View>
        ) : null}

        {tab === "cart" ? (
          <View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{selectedShop?.name ?? "Select a shop"}</Text>
              <Text style={styles.summaryTotal}>{money(cartTotal)}</Text>
              <Text style={styles.summaryFoot}>{cartCount} {cartCount === 1 ? "item" : "items"} · Prices confirmed at checkout</Text>
            </View>
            {cart.map((item) => (
              <View key={item.id} style={styles.cartRow}>
                <View style={styles.productMark}><Text style={styles.productInitial}>{item.product.name.slice(0, 1).toUpperCase()}</Text></View>
                <View style={styles.productCopy}>
                  <Text style={styles.productName}>{item.product.name}</Text>
                  <Text style={styles.productMeta}>{money(item.inventory.selling_price_paise)} / {item.product.unit_label}</Text>
                </View>
                <View style={styles.quantityControl}>
                  <Pressable style={styles.quantityButton} onPress={() => void updateQuantity(item, -1)} accessibilityRole="button" accessibilityLabel="Remove one">
                    <Text style={styles.quantityButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <Pressable style={styles.quantityButton} onPress={() => void updateQuantity(item, 1)} accessibilityRole="button" accessibilityLabel="Add one">
                    <Text style={styles.quantityButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {cart.length === 0 ? <EmptyState title="Your cart is waiting" body="Browse a shop and add the things you need. A cart contains items from one shop at a time." /> : null}

            {cart.length > 0 ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>How would you like your order?</Text>
                <View style={styles.choiceRow}>
                  {(["pickup", "delivery"] as const).map((value) => {
                    const enabled = value === "pickup" ? selectedShop?.pickup_enabled : selectedShop?.delivery_enabled;
                    return (
                      <Pressable
                        key={value}
                        style={[styles.choice, fulfillment === value && styles.choiceSelected, !enabled && styles.choiceDisabled]}
                        onPress={() => enabled && setFulfillment(value)}
                        disabled={!enabled}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.choiceText, fulfillment === value && styles.choiceTextSelected]}>{value === "pickup" ? "Store pickup" : "Local delivery"}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {fulfillment === "delivery" ? (
                  <View>
                    {addresses.map((address) => (
                      <Pressable
                        key={address.id}
                        style={[styles.addressChoice, selectedAddressId === address.id && styles.addressSelected]}
                        onPress={() => setSelectedAddressId(address.id)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.addressName}>{address.label || address.recipient_name}</Text>
                        <Text style={styles.addressDetail}>{address.address_line}, {address.city}, {address.state}</Text>
                      </Pressable>
                    ))}
                    <TextInput style={styles.input} placeholder="Recipient name" value={addressName} onChangeText={setAddressName} />
                    <TextInput style={styles.input} placeholder="Phone number" value={addressPhone} onChangeText={setAddressPhone} keyboardType="phone-pad" />
                    <TextInput style={styles.input} placeholder="Street address" value={addressLine} onChangeText={setAddressLine} />
                    <View style={styles.inputRow}>
                      <TextInput style={[styles.input, styles.inputHalf]} placeholder="City" value={addressCity} onChangeText={setAddressCity} />
                      <TextInput style={[styles.input, styles.inputHalf]} placeholder="State" value={addressState} onChangeText={setAddressState} />
                    </View>
                    <Pressable style={styles.secondaryButton} onPress={() => void addAddress()} disabled={busy} accessibilityRole="button">
                      <Text style={styles.secondaryButtonText}>Save delivery address</Text>
                    </Pressable>
                  </View>
                ) : null}

                <Text style={styles.formLabel}>Payment</Text>
                <View style={styles.choiceRow}>
                  {(["cash", "upi"] as const).map((value) => {
                    const upiUnavailable = value === "upi" && !selectedShop?.upi_id;
                    return (
                    <Pressable
                      key={value}
                      style={[styles.choice, paymentMethod === value && styles.choiceSelected, upiUnavailable && styles.choiceDisabled]}
                      onPress={() => !upiUnavailable && setPaymentMethod(value)}
                      disabled={upiUnavailable}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.choiceText, paymentMethod === value && styles.choiceTextSelected]}>{value === "cash" ? "Cash at shop" : upiUnavailable ? "UPI not set up" : "UPI transfer"}</Text>
                    </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.disclaimer}>UPI payments are manually verified by the shop. Do not send money until the order is accepted.</Text>
                <Pressable style={styles.primaryButton} onPress={() => void placeOrder()} disabled={busy} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Place order · {money(cartTotal + (fulfillment === "delivery" ? selectedShop?.delivery_fee_paise ?? 0 : 0))}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === "orders" ? (
          <View>
            {orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHead}>
                  <View>
                    <Text style={styles.orderNumber}>ORDER {order.order_number}</Text>
                    <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.statusBadge}>{order.status.replace(/_/g, " ").toUpperCase()}</Text>
                </View>
                <Text style={styles.orderShop}>{shops.find((shop) => shop.id === order.shop_id)?.name ?? "Neighbourhood shop"}</Text>
                <View style={styles.orderTimeline} accessibilityLabel="Order status history">
                  {(orderHistory.filter((event) => event.order_id === order.id).length > 0
                    ? orderHistory.filter((event) => event.order_id === order.id)
                    : [{ id: `${order.id}-current`, order_id: order.id, changed_by: null, old_status: null, new_status: order.status, note: null, created_at: order.updated_at }]
                  ).map((event) => (
                    <View key={event.id} style={styles.timelineEvent}>
                      <Ionicons name={event.new_status === order.status ? "checkmark-circle" : "ellipse-outline"} size={15} color={event.new_status === order.status ? colors.green : colors.muted} />
                      <Text style={styles.timelineText}>{event.new_status.replace(/_/g, " ")} · {new Date(event.created_at).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
                {order.items.map((item) => (
                  <View key={item.id} style={styles.orderItem}>
                    <Text style={styles.orderItemName}>{item.quantity} × {item.product_name_snapshot}</Text>
                    <Text style={styles.orderItemPrice}>{money(item.line_total_paise)}</Text>
                  </View>
                ))}
                <View style={styles.orderTotalRow}><Text style={styles.orderTotalLabel}>Total</Text><Text style={styles.orderTotal}>{money(order.total_paise)}</Text></View>
                <Text style={styles.paymentStatus}>Payment · {order.payment_method?.toUpperCase() ?? "—"} · {order.payment_status.toUpperCase()}</Text>
                {order.payment_method === "upi" && order.status === "placed" && order.payment_status === "pending" ? (
                  <Text style={styles.disclaimer}>{order.upi_id_snapshot ? `UPI ID: ${order.upi_id_snapshot} · Pay only after the shop accepts your order.` : "Submit your UPI reference after the shop accepts your order."}</Text>
                ) : null}
                {order.payment_method === "upi" && ["pending", "rejected"].includes(order.payment_status) && order.status !== "placed" ? (
                  <View>
                    {order.upi_id_snapshot ? <Text style={styles.paymentStatus}>Pay to UPI ID: {order.upi_id_snapshot}</Text> : null}
                    <TextInput
                      style={styles.input}
                      placeholder="UPI transaction reference"
                      value={paymentReferences[order.id] ?? ""}
                      onChangeText={(value) => setPaymentReferences((current) => ({ ...current, [order.id]: value }))}
                      autoCapitalize="characters"
                    />
                    <Pressable style={styles.secondaryButton} onPress={() => void submitPaymentReference(order)} disabled={busy} accessibilityRole="button">
                      <Text style={styles.secondaryButtonText}>Submit UPI reference</Text>
                    </Pressable>
                  </View>
                ) : null}
                {order.status === "placed" && order.payment_status === "pending" ? (
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => void run(async () => {
                      await changeOrderStatus(client, order.id, "cancelled", "Cancelled by customer");
                      await refreshOrders();
                    })}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelText}>Cancel order</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {orders.length === 0 ? <EmptyState title="No orders yet" body="Your placed orders and their progress will appear here." /> : null}
          </View>
        ) : null}

        {tab === "account" ? (
          <View>
            <View style={styles.accountCard}>
              <Text style={styles.accountInitial}>{session.user.email?.slice(0, 1).toUpperCase() ?? "K"}</Text>
              <Text style={styles.accountEmail}>{session.user.email}</Text>
              <Text style={styles.accountHint}>Customer account</Text>
            </View>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Contact support</Text>
              <Text style={styles.formLabel}>Related order (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFilters}>
                <Pressable
                  style={[styles.categoryChip, !supportOrderId && styles.categoryChipSelected]}
                  onPress={() => setSupportOrderId(null)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.categoryChipText, !supportOrderId && styles.categoryChipTextSelected]}>General</Text>
                </Pressable>
                {orders.map((order) => (
                  <Pressable
                    key={order.id}
                    style={[styles.categoryChip, supportOrderId === order.id && styles.categoryChipSelected]}
                    onPress={() => setSupportOrderId(order.id)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.categoryChipText, supportOrderId === order.id && styles.categoryChipTextSelected]}>Order {order.order_number}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput style={styles.input} placeholder="What can we help with?" value={ticketSubject} onChangeText={setTicketSubject} />
              <TextInput style={[styles.input, styles.messageInput]} placeholder="Describe the issue" value={ticketMessage} onChangeText={setTicketMessage} multiline />
              <Pressable style={styles.primaryButton} onPress={() => void submitTicket()} disabled={busy} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Send support request</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionTitle}>Your support requests</Text>
            {supportTickets.map((ticket) => (
              <Pressable
                key={ticket.id}
                style={styles.ticketCard}
                onPress={() => setSelectedTicketId((current) => current === ticket.id ? null : ticket.id)}
                accessibilityRole="button"
              >
                <View style={styles.ticketHead}>
                  <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                  <Text style={styles.statusBadge}>{ticket.status.toUpperCase()}</Text>
                </View>
                {selectedTicketId === ticket.id ? (
                  <View style={styles.ticketThread}>
                    {supportMessages.map((message) => (
                      <Text key={message.id} style={styles.threadMessage}>{message.message}</Text>
                    ))}
                    {ticket.status === "open" ? (
                      <View>
                        <TextInput
                          style={[styles.input, styles.messageInput]}
                          placeholder="Reply to this request"
                          value={supportReply}
                          onChangeText={setSupportReply}
                          multiline
                        />
                        <Pressable style={styles.secondaryButton} onPress={() => void sendSupportReply()} disabled={busy} accessibilityRole="button">
                          <Text style={styles.secondaryButtonText}>Send reply</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            ))}
            {supportTickets.length === 0 ? <EmptyState title="No support requests" body="Messages you send to KiranaLink support will be listed here." /> : null}
            <Pressable
              style={styles.signOutButton}
              onPress={() => void run(async () => {
                const { error: signOutError } = await client.auth.signOut();
                if (signOutError) throw signOutError;
              })}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.tabBar}>
        {([
          ["shops", "storefront-outline", "Shops"],
          ["pools", "people-outline", "Pools"],
          ["cart", "cart-outline", "Cart"],
          ["orders", "receipt-outline", "Orders"],
          ["account", "person-outline", "Account"],
        ] as const).map(([key, icon, label]) => (
          <Pressable key={key} style={[styles.tabItem, tab === key && styles.tabItemSelected]} onPress={() => setTab(key)} accessibilityRole="button" accessibilityLabel={key === "cart" && cartCount ? `Cart, ${cartCount} items` : label} accessibilityState={{ selected: tab === key }}>
            <Ionicons name={icon} size={21} color={tab === key ? colors.green : colors.muted} />
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelSelected]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function LoadingScreen() {
  return <View style={styles.loading}><ActivityIndicator color={colors.green} /><Text style={styles.loadingText}>Connecting to your neighbourhood…</Text></View>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.emptyState}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topbar: { width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 13 },
  topEyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1, color: colors.green, marginBottom: 3 },
  topTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.ink },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.greenDark, fontWeight: "900" },
  loader: { marginVertical: 5 },
  errorBanner: { backgroundColor: colors.redSoft, color: colors.red, fontSize: 11, lineHeight: 16, paddingHorizontal: 15, paddingVertical: 9, marginHorizontal: 16, borderRadius: 10 },
  successBanner: { backgroundColor: colors.greenSoft, color: colors.greenDark, fontSize: 10, lineHeight: 15, paddingHorizontal: 15, paddingVertical: 9, marginHorizontal: 16, borderRadius: 10 },
  content: { width: "100%", maxWidth: 1120, alignSelf: "center", padding: 18, paddingBottom: 26 },
  welcome: { backgroundColor: colors.green, borderRadius: 23, padding: 20, marginBottom: 23 },
  welcomeKicker: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 1.1, marginBottom: 10 },
  welcomeTitle: { color: colors.surface, fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.7, marginBottom: 7 },
  welcomeBody: { color: "#E5EFE7", fontSize: 11, lineHeight: 17 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  linkText: { color: colors.green, fontSize: 10, fontWeight: "800" },
  shopCard: { flexDirection: "row", alignItems: "center", padding: 13, backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line, marginBottom: 9 },
  shopIcon: { width: 41, height: 41, borderRadius: 13, backgroundColor: colors.orangeSoft, alignItems: "center", justifyContent: "center" },
  shopIconText: { color: colors.amber, fontWeight: "900", fontSize: 17 },
  shopCopy: { flex: 1, marginLeft: 11 },
  shopName: { color: colors.ink, fontWeight: "800", fontSize: 12, marginBottom: 3 },
  sponsoredBadge: { color: colors.amber, backgroundColor: colors.orangeSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, fontSize: 7, fontWeight: "900", overflow: "hidden", alignSelf: "flex-start", marginBottom: 3 },
  shopMeta: { color: colors.muted, fontSize: 9, marginBottom: 3 },
  shopServices: { color: colors.green, fontWeight: "700", fontSize: 9 },
  chevron: { color: colors.muted, fontSize: 23, marginLeft: 7 },
  shopHero: { backgroundColor: colors.greenSoft, padding: 16, borderRadius: 16, marginBottom: 13 },
  shopEyebrow: { color: colors.green, fontSize: 8, fontWeight: "900", letterSpacing: 1, marginBottom: 5 },
  shopTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", marginBottom: 3 },
  shopDescription: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 8 },
  search: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, height: 45, color: colors.ink, fontSize: 11, marginBottom: 10 },
  categoryFilters: { gap: 7, paddingBottom: 10 },
  categoryChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12 },
  categoryChipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  categoryChipText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  categoryChipTextSelected: { color: colors.surface },
  productCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 11, marginBottom: 8 },
  productMark: { width: 43, height: 43, borderRadius: 13, backgroundColor: colors.orangeSoft, justifyContent: "center", alignItems: "center" },
  productInitial: { color: colors.amber, fontWeight: "900", fontSize: 16 },
  productCopy: { flex: 1, marginLeft: 10 },
  productTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  productName: { color: colors.ink, fontWeight: "800", fontSize: 11, marginBottom: 4 },
  productMeta: { color: colors.muted, fontSize: 9 },
  poolIntro: { backgroundColor: colors.green, borderRadius: 20, padding: 18, marginBottom: 16 },
  poolCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 10 },
  poolCardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  poolProductIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  poolStatus: { color: colors.greenDark, backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5, fontSize: 7, fontWeight: "900", overflow: "hidden" },
  poolPriceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  poolPrice: { color: colors.greenDark, fontSize: 13, fontWeight: "900" },
  poolWasPrice: { color: colors.muted, fontSize: 9, textDecorationLine: "line-through" },
  poolProgressText: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  poolDetail: { color: colors.muted, fontSize: 8, lineHeight: 13, flexShrink: 1 },
  poolProgressTrack: { height: 7, borderRadius: 4, backgroundColor: colors.line, overflow: "hidden", marginBottom: 10 },
  poolProgressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.green },
  poolAddresses: { marginBottom: 7 },
  productAction: { alignItems: "flex-end", marginLeft: 6 },
  price: { color: colors.ink, fontSize: 11, fontWeight: "900", marginBottom: 5 },
  smallButton: { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  smallButtonText: { color: colors.surface, fontWeight: "800", fontSize: 9 },
  backButton: { alignSelf: "flex-start", marginBottom: 12 },
  backText: { color: colors.green, fontSize: 11, fontWeight: "800" },
  summaryCard: { backgroundColor: colors.green, borderRadius: 18, padding: 17, marginBottom: 12 },
  summaryLabel: { color: colors.lime, fontWeight: "800", fontSize: 10 },
  summaryTotal: { color: colors.surface, fontWeight: "900", fontSize: 27, marginVertical: 3 },
  summaryFoot: { color: "#DFECE2", fontSize: 9 },
  cartRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 13, borderWidth: 1, borderColor: colors.line, padding: 10, marginBottom: 7 },
  quantityControl: { flexDirection: "row", alignItems: "center", gap: 8 },
  quantityButton: { width: 27, height: 27, borderRadius: 9, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  quantityButtonText: { color: colors.greenDark, fontWeight: "900", fontSize: 15 },
  quantity: { color: colors.ink, fontWeight: "800", fontSize: 11, minWidth: 13, textAlign: "center" },
  formCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginTop: 12 },
  formTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginBottom: 12 },
  formLabel: { color: colors.ink, fontSize: 11, fontWeight: "800", marginTop: 14, marginBottom: 8 },
  choiceRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  choice: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.line, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  choiceSelected: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  choiceDisabled: { opacity: 0.4 },
  choiceText: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  choiceTextSelected: { color: colors.greenDark },
  addressChoice: { borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 10, marginBottom: 8 },
  addressSelected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  addressName: { color: colors.ink, fontWeight: "800", fontSize: 10 },
  addressDetail: { color: colors.muted, fontSize: 9, marginTop: 3 },
  input: { height: 42, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FBFCFA", borderRadius: 10, paddingHorizontal: 11, color: colors.ink, fontSize: 10, marginBottom: 8 },
  inputRow: { flexDirection: "row", gap: 8 },
  inputHalf: { flex: 1 },
  messageInput: { height: 90, textAlignVertical: "top", paddingTop: 11 },
  secondaryButton: { borderRadius: 11, borderWidth: 1, borderColor: colors.green, minHeight: 40, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  secondaryButtonText: { color: colors.green, fontWeight: "800", fontSize: 10 },
  disclaimer: { color: colors.muted, fontSize: 9, lineHeight: 14, marginBottom: 11 },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 10 },
  primaryButtonText: { color: colors.surface, fontSize: 11, fontWeight: "900" },
  orderCard: { backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 13, marginBottom: 10 },
  orderHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  orderNumber: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  orderDate: { color: colors.muted, fontSize: 9, marginTop: 3 },
  statusBadge: { color: colors.greenDark, backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: "900" },
  orderShop: { color: colors.green, fontSize: 10, fontWeight: "800", marginBottom: 7 },
  orderTimeline: { borderLeftWidth: 1, borderLeftColor: colors.line, marginLeft: 7, marginVertical: 8, paddingLeft: 10, gap: 7 },
  timelineEvent: { flexDirection: "row", alignItems: "center", gap: 7 },
  timelineText: { flex: 1, color: colors.muted, fontSize: 9, textTransform: "capitalize" },
  orderItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  orderItemName: { color: colors.muted, fontSize: 9 },
  orderItemPrice: { color: colors.ink, fontSize: 9, fontWeight: "700" },
  orderTotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, marginTop: 7, paddingTop: 8 },
  orderTotalLabel: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  orderTotal: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  paymentStatus: { color: colors.muted, fontSize: 9, marginTop: 8, marginBottom: 8 },
  cancelButton: { alignSelf: "flex-start", paddingVertical: 7 },
  cancelText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  accountCard: { alignItems: "center", backgroundColor: colors.greenSoft, borderRadius: 16, padding: 19, marginBottom: 13 },
  accountInitial: { width: 45, height: 45, borderRadius: 23, backgroundColor: colors.green, color: colors.lime, textAlign: "center", textAlignVertical: "center", fontSize: 18, fontWeight: "900", overflow: "hidden", marginBottom: 8 },
  accountEmail: { color: colors.ink, fontWeight: "800", fontSize: 12 },
  accountHint: { color: colors.muted, fontSize: 9, marginTop: 4 },
  ticketCard: { backgroundColor: colors.surface, borderRadius: 13, borderWidth: 1, borderColor: colors.line, padding: 11, marginBottom: 8 },
  ticketHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 7 },
  ticketSubject: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: "800" },
  ticketThread: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 9, paddingTop: 9 },
  threadMessage: { color: colors.ink, backgroundColor: colors.greenSoft, borderRadius: 9, padding: 8, fontSize: 9, lineHeight: 14, marginBottom: 6 },
  signOutButton: { alignItems: "center", padding: 14 },
  signOutText: { color: colors.red, fontWeight: "800", fontSize: 11 },
  emptyState: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 15, padding: 19, alignItems: "center", marginVertical: 10 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", textAlign: "center" },
  emptyBody: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: "center", marginTop: 6 },
  tabBar: { flexDirection: "row", backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, paddingBottom: 5, paddingTop: 9 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 7, borderRadius: 12, marginHorizontal: 2 },
  tabItemSelected: { backgroundColor: colors.greenSoft },
  tabLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  tabLabelSelected: { color: colors.green, fontWeight: "900" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  loadingText: { color: colors.muted, fontSize: 11, marginTop: 10 },
});
