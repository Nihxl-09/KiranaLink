import React, { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  changeOrderStatus,
  addShopMemberByEmail,
  createProductPool,
  createShopAdCampaign,
  createBackendClient,
  getActiveCategories,
  getMerchantPlans,
  getMerchantSubscription,
  getRetailerShop,
  getRetailerProductPools,
  getShopMembers,
  getRetailerSummary,
  getShopAdCampaigns,
  getShopCatalog,
  getShopOrders,
  getSupportMessages,
  getSupportTickets,
  isBackendConfigured,
  markCashOrderPaid,
  OrderStatus,
  OrderWithItems,
  replyToSupportTicket,
  registerExpoPushToken,
  removeShopMember,
  reviewPayment,
  saveInventoryItem,
  saveRetailerShop,
  setProductImage as saveProductImagePath,
  setSupportTicketStatus,
  Session,
  MerchantPlan,
  MerchantSubscription,
  ProductPool,
  ShopAdCampaign,
  ShopMemberListing,
} from "@kiranalink/backend";
import { AuthPanel, BackendSetupNotice, colors, radius } from "@kiranalink/ui";

type Shop = NonNullable<Awaited<ReturnType<typeof getRetailerShop>>>;
type CatalogItem = Awaited<ReturnType<typeof getShopCatalog>>[number];
type Category = Awaited<ReturnType<typeof getActiveCategories>>[number];
type Ticket = Awaited<ReturnType<typeof getSupportTickets>>[number];
type Summary = NonNullable<Awaited<ReturnType<typeof getRetailerSummary>>>;
type Tab = "overview" | "products" | "orders" | "reports" | "growth" | "support" | "store";
type SelectedProductImage = { uri: string; mimeType: string; fileSize?: number };

const money = (paise: number) => `₹${(paise / 100).toFixed(2)}`;
function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error !== "object" || error === null || !("message" in error) || typeof error.message !== "string") {
    return "Something went wrong. Please try again.";
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  if (code === "PGRST202" && /create_retailer_shop/i.test(error.message)) {
    return "Shop creation is not installed in Supabase. Apply migration 0007_create_retailer_shop_rpc.sql, then reload.";
  }
  if (code === "42501" && /row-level security policy for table "shops"/i.test(error.message)) {
    return "Supabase rejected shop creation. Apply migration 0007_create_retailer_shop_rpc.sql to the project configured in this app, then reload.";
  }
  if (
    code === "42P01"
    || code === "PGRST205"
    || /relation .* does not exist|could not find the table/i.test(error.message)
  ) {
    return "Supabase is missing required database tables. Apply the migrations in supabase/migrations, then reload.";
  }

  const details = "details" in error && typeof error.details === "string" ? error.details : "";
  const hint = "hint" in error && typeof error.hint === "string" ? error.hint : "";
  return [error.message, details, hint].filter(Boolean).join(" ");
}

export default function RetailerHome() {
  if (!isBackendConfigured()) return <BackendSetupNotice audience="retailer" />;
  return <ConnectedRetailerApp />;
}

function ConnectedRetailerApp() {
  const client = useMemo(() => createBackendClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [shop, setShop] = useState<Shop | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [merchantPlans, setMerchantPlans] = useState<MerchantPlan[]>([]);
  const [merchantSubscription, setMerchantSubscription] = useState<MerchantSubscription | null>(null);
  const [confirmCancelPlan, setConfirmCancelPlan] = useState(false);
  const [adCampaigns, setAdCampaigns] = useState<ShopAdCampaign[]>([]);
  const [productPools, setProductPools] = useState<ProductPool[]>([]);
  const [shopMembers, setShopMembers] = useState<ShopMemberListing[]>([]);
  const [staffEmail, setStaffEmail] = useState("");
  const [reportSummary, setReportSummary] = useState<Summary | null>(null);
  const [reportFrom, setReportFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof getSupportMessages>>>([]);

  const [shopName, setShopName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopLocality, setShopLocality] = useState("");
  const [shopCity, setShopCity] = useState("");
  const [shopState, setShopState] = useState("");
  const [shopPostalCode, setShopPostalCode] = useState("");
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [minimumOrder, setMinimumOrder] = useState("0");
  const [openingTime, setOpeningTime] = useState("09:00:00");
  const [closingTime, setClosingTime] = useState("21:00:00");
  const [upiId, setUpiId] = useState("");

  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productUnit, setProductUnit] = useState("piece");
  const [productPrice, setProductPrice] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [lowStock, setLowStock] = useState("5");
  const [productAvailable, setProductAvailable] = useState(true);
  const [productImage, setProductImage] = useState<SelectedProductImage | null>(null);
  const [productImagePath, setProductImagePath] = useState<string | null>(null);
  const [upiReviewNotes, setUpiReviewNotes] = useState<Record<string, string>>({});
  const [supportReply, setSupportReply] = useState("");
  const [adTargetType, setAdTargetType] = useState<"store" | "product">("store");
  const [adProductId, setAdProductId] = useState<string | null>(null);
  const [adDurationDays, setAdDurationDays] = useState("7");
  const [poolProductId, setPoolProductId] = useState<string | null>(null);
  const [poolTargetQuantity, setPoolTargetQuantity] = useState("10");
  const [poolUnitPrice, setPoolUnitPrice] = useState("");
  const [poolDeadlineHours, setPoolDeadlineHours] = useState("72");
  const canEditProductDetails = !editingItem || editingItem.product.created_by === session?.user.id;
  const isShopOwner = Boolean(shop && session && shop.owner_id === session.user.id);
  const hasMerchantAccess = Boolean(
    merchantSubscription?.status === "active"
    || merchantSubscription?.status === "trialing"
      && merchantSubscription.trial_ends_at
      && Date.parse(merchantSubscription.trial_ends_at) > Date.now(),
  );
  const hasAdvancedAccess = Boolean(
    merchantSubscription?.status === "active" && merchantSubscription.plan_key === "advanced"
    || merchantSubscription?.status === "trialing"
      && merchantSubscription.trial_ends_at
      && Date.parse(merchantSubscription.trial_ends_at) > Date.now(),
  );

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
        "missing-project-id": "Push setup is incomplete. Initialize EAS for the Retailer app, then install its development build.",
        "permission-denied": "Notifications are turned off for KiranaLink Business. Enable them in your device settings to receive order updates.",
      };
      setStatusMessage(notices[pushStatus]);
    }).catch((pushError: unknown) => {
      if (active) setError(`Push notifications could not be enabled: ${messageOf(pushError)}`);
    });
    return () => { active = false; };
  }, [client, session]);

  const loadWorkspace = async (ownerId: string) => {
    const currentShop = await getRetailerShop(client, ownerId);
    setShop(currentShop);
    if (!currentShop) {
      setCatalog([]);
      setCategories([]);
      setOrders([]);
      setSummary(null);
      setMerchantPlans([]);
      setMerchantSubscription(null);
      setAdCampaigns([]);
      setProductPools([]);
      setShopMembers([]);
      return;
    }
    const [nextCatalog, nextCategories, nextOrders, nextSummary, nextTickets, nextPlans, nextSubscription, nextAds, nextPools, nextMembers] = await Promise.all([
      getShopCatalog(client, currentShop.id, true),
      getActiveCategories(client),
      getShopOrders(client, currentShop.id),
      getRetailerSummary(client, currentShop.id),
      getSupportTickets(client, { shopId: currentShop.id }),
      getMerchantPlans(client),
      getMerchantSubscription(client, ownerId),
      getShopAdCampaigns(client, currentShop.id),
      getRetailerProductPools(client, currentShop.id),
      getShopMembers(client, currentShop.id),
    ]);
    setCatalog(nextCatalog);
    setCategories(nextCategories);
    setOrders(nextOrders);
    setSummary(nextSummary);
    setTickets(nextTickets);
    setMerchantPlans(nextPlans);
    setMerchantSubscription(nextSubscription);
    setAdCampaigns(nextAds);
    setProductPools(nextPools);
    setShopMembers(nextMembers);
  };

  useEffect(() => {
    if (!session) {
      setShop(null);
      setCatalog([]);
      setOrders([]);
      setSummary(null);
      setTickets([]);
      return;
    }
    let active = true;
    setBusy(true);
    loadWorkspace(session.user.id).catch((loadError: unknown) => {
      if (active) setError(messageOf(loadError));
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [client, session]);

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }
    let active = true;
    getSupportMessages(client, selectedTicketId).then((rows) => {
      if (active) setMessages(rows);
    }).catch((loadError: unknown) => {
      if (active) setError(messageOf(loadError));
    });
    return () => { active = false; };
  }, [client, selectedTicketId]);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (actionError) {
      setError(messageOf(actionError));
    } finally {
      setBusy(false);
    }
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
    if (!data.session) setAuthNotice("Check your email to confirm your account, then sign in.");
  };

  const handlePasswordRecovery = async (email: string) => {
    const { error: recoveryError } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL("auth/callback", { queryParams: { flow: "recovery" } }),
    });
    if (recoveryError) throw recoveryError;
  };

  const fillShopForm = (currentShop: Shop | null) => {
    setShopName(currentShop?.name ?? "");
    setShopDescription(currentShop?.description ?? "");
    setShopPhone(currentShop?.phone ?? "");
    setShopAddress(currentShop?.address_line ?? "");
    setShopLocality(currentShop?.locality ?? "");
    setShopCity(currentShop?.city ?? "");
    setShopState(currentShop?.state ?? "");
    setShopPostalCode(currentShop?.postal_code ?? "");
    setPickupEnabled(currentShop?.pickup_enabled ?? true);
    setDeliveryEnabled(currentShop?.delivery_enabled ?? false);
    setDeliveryFee(String((currentShop?.delivery_fee_paise ?? 0) / 100));
    setMinimumOrder(String((currentShop?.minimum_order_paise ?? 0) / 100));
    setOpeningTime(currentShop?.opening_time ?? "09:00:00");
    setClosingTime(currentShop?.closing_time ?? "21:00:00");
    setUpiId(currentShop?.upi_id ?? "");
  };

  const saveShop = async () => {
    if (!session) return;
    if (!shopName.trim() || !shopPhone.trim() || !shopAddress.trim() || !shopCity.trim() || !shopState.trim()) {
      setError("Enter your shop name, phone, street address, city and state.");
      return;
    }
    if (!pickupEnabled && !deliveryEnabled) {
      setError("Enable pickup, delivery, or both.");
      return;
    }
    const parsedDeliveryFee = Number(deliveryFee);
    const parsedMinimum = Number(minimumOrder);
    if (!Number.isFinite(parsedDeliveryFee) || parsedDeliveryFee < 0 || !Number.isFinite(parsedMinimum) || parsedMinimum < 0) {
      setError("Delivery fee and minimum order must be zero or more.");
      return;
    }
    await run(async () => {
      await saveRetailerShop(client, session.user.id, shop?.id ?? null, {
        name: shopName.trim(),
        description: shopDescription.trim() || null,
        phone: shopPhone.trim() || null,
        address_line: shopAddress.trim() || null,
        locality: shopLocality.trim() || null,
        city: shopCity.trim(),
        state: shopState.trim(),
        postal_code: shopPostalCode.trim() || null,
        pickup_enabled: pickupEnabled,
        delivery_enabled: deliveryEnabled,
        delivery_fee_paise: Math.round(parsedDeliveryFee * 100),
        minimum_order_paise: Math.round(parsedMinimum * 100),
        opening_time: openingTime.trim() || null,
        closing_time: closingTime.trim() || null,
        support_phone: shopPhone.trim() || null,
        upi_id: upiId.trim() || null,
      });
      await loadWorkspace(session.user.id);
      setTab("overview");
    });
  };

  const toggleShopLive = async () => {
    if (!shop || !session) return;
    if (!shop.is_active && !catalog.some((item) => item.inventory.is_available && item.inventory.available_quantity > 0 && item.product.is_active)) {
      setError("Add at least one active, in-stock product before making your shop visible.");
      return;
    }
    await run(async () => {
      const { error: updateError } = await client
        .from("shops")
        .update({ is_active: !shop.is_active })
        .eq("id", shop.id)
        .eq("owner_id", session.user.id);
      if (updateError) throw updateError;
      await loadWorkspace(session.user.id);
    });
  };

  const resetProductForm = () => {
    setEditingItem(null);
    setSelectedCategoryId(null);
    setProductName("");
    setProductDescription("");
    setProductUnit("piece");
    setProductPrice("");
    setProductQuantity("");
    setLowStock("5");
    setProductAvailable(true);
    setProductImage(null);
    setProductImagePath(null);
  };

  const editProduct = (item: CatalogItem) => {
    setEditingItem(item);
    setSelectedCategoryId(item.product.category_id);
    setProductName(item.product.name);
    setProductDescription(item.product.description ?? "");
    setProductUnit(item.product.unit_label);
    setProductPrice((item.inventory.selling_price_paise / 100).toFixed(2));
    setProductQuantity(String(item.inventory.available_quantity));
    setLowStock(String(item.inventory.low_stock_threshold));
    setProductAvailable(item.inventory.is_available);
    setProductImage(null);
    setProductImagePath(item.product.image_path);
  };

  const chooseProductImage = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo-library access to choose a product image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType?.toLowerCase();
    if (!mimeType || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      setError("Choose a JPEG, PNG, or WebP product image.");
      return;
    }
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      setError("Product images must be 5 MB or smaller.");
      return;
    }
    setProductImage({ uri: asset.uri, mimeType, fileSize: asset.fileSize });
  };

  const saveProduct = async () => {
    if (!shop) return;
    const price = Number(productPrice);
    const quantity = Number(productQuantity);
    const threshold = Number(lowStock);
    if ((!editingItem && !productName.trim()) || !productUnit.trim()) {
      setError("Enter a product name and unit.");
      return;
    }
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(threshold) || threshold < 0) {
      setError("Price and stock values must be zero or more.");
      return;
    }
    await run(async () => {
      const inventoryId = await saveInventoryItem(client, {
        p_shop_id: shop.id,
        p_product_id: editingItem?.product.id ?? null,
        p_name: canEditProductDetails ? productName.trim() : null,
        p_description: canEditProductDetails ? productDescription.trim() || null : null,
        p_category_id: selectedCategoryId,
        p_unit_label: productUnit.trim(),
        p_selling_price_paise: Math.round(price * 100),
        p_quantity: quantity,
        p_low_stock_threshold: threshold,
        p_is_available: productAvailable,
      });
      if (productImage) {
        const { data: inventoryRow, error: inventoryError } = await client
          .from("inventory")
          .select("product_id")
          .eq("id", inventoryId)
          .single();
        if (inventoryError) throw inventoryError;
        const response = await fetch(productImage.uri);
        const imageBlob = await response.blob();
        const extension = productImage.mimeType === "image/png" ? "png" : productImage.mimeType === "image/webp" ? "webp" : "jpg";
        const imagePath = `${shop.id}/${inventoryRow.product_id}/${Date.now()}.${extension}`;
        const { data: uploaded, error: uploadError } = await client.storage
          .from("product-images")
          .upload(imagePath, imageBlob, { contentType: productImage.mimeType, upsert: false });
        if (uploadError) throw uploadError;
        await saveProductImagePath(client, inventoryRow.product_id, uploaded.path);
      }
      await loadWorkspace(session!.user.id);
      resetProductForm();
    });
  };

  const startMerchantSubscription = async (planKey: "basic" | "advanced") => {
    await run(async () => {
      const { data, error: functionError } = await client.functions.invoke<{
        active?: boolean;
        checkoutUrl?: string;
      }>("create-merchant-subscription", { body: { planKey } });
      if (functionError) throw functionError;
      if (data?.active) {
        setStatusMessage("This merchant plan is already active.");
        await loadWorkspace(session!.user.id);
        return;
      }
      if (!data?.checkoutUrl) throw new Error("Razorpay did not return a subscription checkout link.");
      await Linking.openURL(data.checkoutUrl);
      setStatusMessage("Complete the secure Razorpay authorization. Your plan status updates after Supabase receives the signed webhook.");
      await loadWorkspace(session!.user.id);
    });
  };

  const cancelMerchantSubscription = async () => {
    await run(async () => {
      const { data, error: functionError } = await client.functions.invoke<{
        cancellationRequested?: boolean;
        effectiveAt?: string | null;
      }>("cancel-merchant-subscription", { body: {} });
      if (functionError) throw functionError;
      if (!data?.cancellationRequested) throw new Error("Razorpay did not confirm the cancellation request.");
      setConfirmCancelPlan(false);
      setStatusMessage(
        data.effectiveAt
          ? `Renewal cancellation requested. Access remains until ${new Date(data.effectiveAt).toLocaleDateString()}.`
          : "Renewal cancellation requested. Access remains until Razorpay confirms the end of the current cycle.",
      );
      await loadWorkspace(session!.user.id);
    });
  };

  const requestAdPayment = async (campaignId: string) => {
    const { data, error: functionError } = await client.functions.invoke<{ paymentUrl?: string }>(
      "create-ad-payment-link",
      { body: { campaignId } },
    );
    if (functionError) throw functionError;
    if (!data?.paymentUrl) throw new Error("Razorpay did not return an advertising payment link.");
    await Linking.openURL(data.paymentUrl);
    setStatusMessage("Complete the secure Razorpay payment. The campaign starts after its signed payment webhook is verified.");
  };

  const openAdPayment = async (campaignId: string) => {
    await run(async () => {
      await requestAdPayment(campaignId);
      await loadWorkspace(session!.user.id);
    });
  };

  const createAd = async () => {
    if (!shop) return;
    const durationDays = Number(adDurationDays);
    if (!Number.isInteger(durationDays) || durationDays < 7 || durationDays > 365) {
      setError("Choose an advertising duration from 7 to 365 days.");
      return;
    }
    const productId = adTargetType === "product"
      ? adProductId ?? catalog[0]?.product.id ?? null
      : null;
    if (adTargetType === "product" && !productId) {
      setError("Add an available product before creating a product advertisement.");
      return;
    }
    await run(async () => {
      const campaign = await createShopAdCampaign(client, {
        shopId: shop.id,
        targetType: adTargetType,
        productId,
        durationDays,
      });
      await requestAdPayment(campaign.id);
      await loadWorkspace(session!.user.id);
    });
  };

  const createPool = async () => {
    if (!shop) return;
    const productId = poolProductId ?? catalog.find((item) =>
      item.inventory.is_available && item.inventory.available_quantity > 0
    )?.product.id;
    const product = catalog.find((item) => item.product.id === productId);
    const targetQuantity = Number(poolTargetQuantity);
    const poolPriceRupees = Number(poolUnitPrice);
    const deadlineHours = Number(poolDeadlineHours);
    if (!productId || !product) {
      setError("Add an available product before creating a product pool.");
      return;
    }
    if (!Number.isFinite(targetQuantity) || targetQuantity < 2) {
      setError("Set a pool target of at least 2 units.");
      return;
    }
    if (!Number.isFinite(poolPriceRupees) || poolPriceRupees <= 0
      || poolPriceRupees * 100 >= product.inventory.selling_price_paise) {
      setError("The pooled price must be positive and lower than the regular product price.");
      return;
    }
    if (!Number.isFinite(deadlineHours) || deadlineHours < 1 || deadlineHours > 720) {
      setError("Set a deadline from 1 hour to 30 days.");
      return;
    }
    await run(async () => {
      await createProductPool(client, {
        shopId: shop.id,
        productId,
        targetQuantity,
        poolUnitPricePaise: Math.round(poolPriceRupees * 100),
        endsAt: new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString(),
      });
      setStatusMessage("Product pool published. Customer reservations do not take payment until the target is met.");
      await loadWorkspace(session!.user.id);
    });
  };

  const addStaffMember = async () => {
    if (!shop || !staffEmail.trim()) {
      setError("Enter the email of an existing KiranaLink account.");
      return;
    }
    await run(async () => {
      await addShopMemberByEmail(client, shop.id, staffEmail.trim());
      setStaffEmail("");
      setStatusMessage("Shop staff access was added.");
      await loadWorkspace(session!.user.id);
    });
  };

  const removeStaffMember = async (userId: string) => {
    if (!shop) return;
    await run(async () => {
      await removeShopMember(client, shop.id, userId);
      setStatusMessage("Shop staff access was removed.");
      await loadWorkspace(session!.user.id);
    });
  };

  const runAdvancedReport = async () => {
    if (!shop) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(reportTo)
      || reportFrom > reportTo) {
      setError("Enter a valid report range with the start date on or before the end date.");
      return;
    }
    await run(async () => {
      const nextReport = await getRetailerSummary(client, shop.id, reportFrom, reportTo);
      setReportSummary(nextReport);
      setStatusMessage(`Report loaded for ${reportFrom} to ${reportTo}.`);
    });
  };

  const processOrder = async (order: OrderWithItems, nextStatus: OrderStatus) => {
    await run(async () => {
      await changeOrderStatus(client, order.id, nextStatus);
      await loadWorkspace(session!.user.id);
    });
  };

  const submitSupportReply = async () => {
    if (!selectedTicketId || !supportReply.trim()) {
      setError("Write a reply before sending.");
      return;
    }
    await run(async () => {
      await replyToSupportTicket(client, selectedTicketId, supportReply.trim());
      setSupportReply("");
      setMessages(await getSupportMessages(client, selectedTicketId));
      setTickets(await getSupportTickets(client, { shopId: shop!.id }));
    });
  };

  if (authLoading) return <LoadingScreen />;
  if (!session) return <AuthPanel audience="retailer" statusMessage={authNotice} onSubmit={handleAuth} onRecoverPassword={handlePasswordRecovery} />;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <View style={styles.topbarCopy}>
          <Text style={styles.topEyebrow}>KIRANALINK BUSINESS</Text>
          <Text style={styles.topTitle} numberOfLines={1}>{shop?.name ?? "Set up your shop"}</Text>
        </View>
        <View style={[styles.liveBadge, shop?.is_active && hasMerchantAccess ? styles.liveBadgeActive : null]}>
          <View style={[styles.liveDot, shop?.is_active && hasMerchantAccess ? styles.liveDotActive : null]} />
          <Text style={[styles.liveText, shop?.is_active && hasMerchantAccess ? styles.liveTextActive : null]}>
            {!shop ? "SETUP" : !shop.is_active ? "DRAFT" : hasMerchantAccess ? "LIVE" : "PLAN REQUIRED"}
          </Text>
        </View>
      </View>
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {statusMessage ? <Text style={styles.successBanner}>{statusMessage}</Text> : null}
      {busy ? <ActivityIndicator style={styles.loader} color={colors.green} /> : null}

      {!shop ? (
        <Pressable
          style={styles.switchAccountButton}
          onPress={() => void run(async () => {
            const { error: signOutError } = await client.auth.signOut({ scope: "local" });
            if (signOutError) throw signOutError;
          })}
          disabled={busy}
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={16} color={colors.green} />
          <Text style={styles.switchAccountText}>Sign out to switch account</Text>
        </Pressable>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!shop ? (
          <ShopForm
            title="Set up your neighbourhood shop"
            subtitle="Create your store profile. You can add products and publish it when you’re ready."
            shopName={shopName} setShopName={setShopName}
            shopDescription={shopDescription} setShopDescription={setShopDescription}
            shopPhone={shopPhone} setShopPhone={setShopPhone}
            shopAddress={shopAddress} setShopAddress={setShopAddress}
            shopLocality={shopLocality} setShopLocality={setShopLocality}
            shopCity={shopCity} setShopCity={setShopCity}
            shopState={shopState} setShopState={setShopState}
            shopPostalCode={shopPostalCode} setShopPostalCode={setShopPostalCode}
            pickupEnabled={pickupEnabled} setPickupEnabled={setPickupEnabled}
            deliveryEnabled={deliveryEnabled} setDeliveryEnabled={setDeliveryEnabled}
            deliveryFee={deliveryFee} setDeliveryFee={setDeliveryFee}
            minimumOrder={minimumOrder} setMinimumOrder={setMinimumOrder}
            openingTime={openingTime} setOpeningTime={setOpeningTime}
            closingTime={closingTime} setClosingTime={setClosingTime}
            upiId={upiId} setUpiId={setUpiId}
            onSave={() => void saveShop()} busy={busy}
          />
        ) : tab === "overview" ? (
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroKicker}>YOUR SHOP AT A GLANCE</Text>
              <Text style={styles.heroTitle}>
                {shop.is_active && hasMerchantAccess
                  ? "Your shop is open to the neighbourhood."
                  : shop.is_active
                    ? "Choose a plan to restore shop visibility."
                    : "Your shop is almost ready."}
              </Text>
              <Text style={styles.heroBody}>
                {shop.is_active && hasMerchantAccess
                  ? "Keep your catalogue and order status up to date."
                  : shop.is_active
                    ? "Customers cannot see or order from your shop until its trial or subscription is active."
                    : "Finish your catalogue, then publish your shop when you're ready."}
              </Text>
              {isShopOwner && shop.is_active && !hasMerchantAccess ? (
                <Pressable style={styles.heroButton} onPress={() => setTab("growth")} accessibilityRole="button">
                  <Text style={styles.heroButtonText}>Manage subscription</Text>
                </Pressable>
              ) : null}
              {isShopOwner && (!shop.is_active || hasMerchantAccess) ? (
                <Pressable
                  style={[styles.heroButton, !shop.is_active && catalog.length === 0 && styles.heroButtonDisabled]}
                  onPress={() => void toggleShopLive()}
                  disabled={busy || (!shop.is_active && catalog.length === 0)}
                  accessibilityRole="button"
                >
                  <Text style={styles.heroButtonText}>{shop.is_active ? "Pause shop" : "Publish shop"}</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.metricGrid}>
              <Metric label="ORDERS" value={String(summary?.order_count ?? 0)} detail="Selected report period" />
              <Metric label="GROSS SALES" value={money(summary?.gross_sales_paise ?? 0)} detail="Not including refunds" />
              <Metric label="NEEDS ATTENTION" value={String(summary?.pending_orders ?? 0)} detail="Orders to process" />
              <Metric label="LOW STOCK" value={String(summary?.low_stock_items ?? 0)} detail="At or below threshold" />
            </View>
            <View style={styles.quickLinks}>
              <QuickLink icon="cube-outline" title="Manage products" detail={`${catalog.length} catalogue items`} onPress={() => { resetProductForm(); setTab("products"); }} />
              <QuickLink icon="receipt-outline" title="View orders" detail={`${summary?.pending_orders ?? 0} pending`} onPress={() => setTab("orders")} />
              {isShopOwner ? <QuickLink icon="trending-up-outline" title="Growth and plans" detail="Subscriptions, advertising and product pools" onPress={() => setTab("growth")} /> : null}
              {isShopOwner ? <QuickLink icon="storefront-outline" title="Edit store details" detail="Hours, location and fulfilment" onPress={() => { fillShopForm(shop); setTab("store"); }} /> : null}
            </View>
          </View>
        ) : null}

        {shop && isShopOwner && tab === "growth" ? (
          <View>
            <View style={styles.growthHero}>
              <Text style={styles.heroKicker}>KIRANALINK GROWTH</Text>
              <Text style={styles.heroTitle}>Build repeat business.</Text>
              <Text style={styles.heroBody}>Choose a merchant plan, promote your shop or a product, and create pooled offers. Advertising starts only after Razorpay confirms payment.</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Merchant subscription</Text>
              {!merchantSubscription ? (
                <Text style={styles.growthNote}>Publish your shop to start the three-month ₹0 trial. The trial begins on first publication and is not reset by pausing the shop.</Text>
              ) : (
                <>
                  <Text style={styles.growthPlanName}>
                    {merchantPlans.find((plan) => plan.plan_key === merchantSubscription.plan_key)?.display_name ?? merchantSubscription.plan_key}
                  </Text>
                  <Text style={styles.growthNote}>
                    Status: {merchantSubscription.status.toUpperCase()}
                    {merchantSubscription.status === "trialing" && merchantSubscription.trial_ends_at
                      ? ` · trial ends ${new Date(merchantSubscription.trial_ends_at).toLocaleDateString()}`
                      : ""}
                    {merchantSubscription.current_period_end
                      ? ` · next period ends ${new Date(merchantSubscription.current_period_end).toLocaleDateString()}`
                      : ""}
                    {merchantSubscription.cancel_at_period_end ? " · renewal cancellation requested" : ""}
                  </Text>
                  {merchantSubscription.status === "trialing" && merchantSubscription.trial_ends_at
                    && Date.parse(merchantSubscription.trial_ends_at) <= Date.now()
                    ? <Text style={styles.growthWarning}>The trial has ended. A paid plan must be active for customers to see and order from your shop.</Text>
                    : null}
                  {merchantSubscription.razorpay_subscription_id
                    && ["active", "trialing", "pending"].includes(merchantSubscription.status)
                    && !merchantSubscription.cancel_at_period_end ? (
                    confirmCancelPlan ? (
                      <View style={styles.cancelConfirm}>
                        <Text style={styles.growthNote}>Cancel renewal at the end of the current Razorpay cycle? Current access remains until then.</Text>
                        <View style={styles.choiceRow}>
                          <Pressable style={styles.cancelConfirmButton} onPress={() => setConfirmCancelPlan(false)} disabled={busy} accessibilityRole="button">
                            <Text style={styles.secondaryButtonText}>Keep plan</Text>
                          </Pressable>
                          <Pressable style={styles.dangerButton} onPress={() => void cancelMerchantSubscription()} disabled={busy} accessibilityRole="button">
                            <Text style={styles.dangerButtonText}>Confirm cancellation</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable style={styles.cancelButton} onPress={() => setConfirmCancelPlan(true)} disabled={busy} accessibilityRole="button">
                        <Text style={styles.cancelText}>Turn off renewal</Text>
                      </Pressable>
                    )
                  ) : null}
                </>
              )}
              {merchantPlans.filter((plan) => plan.plan_key !== "trial").map((plan) => {
                const isCurrent = merchantSubscription?.plan_key === plan.plan_key
                  && merchantSubscription.status === "active";
                const planIsLocked = merchantSubscription?.status === "active";
                return (
                  <View key={plan.plan_key} style={styles.planCard}>
                    <View style={styles.planHeading}>
                      <Text style={styles.growthPlanName}>{plan.display_name}</Text>
                      <Text style={styles.planPrice}>{money(plan.monthly_price_paise)}<Text style={styles.growthNote}> / month</Text></Text>
                    </View>
                    <Text style={styles.growthNote}>{plan.feature_summary}</Text>
                    <Pressable
                      style={[styles.primaryButton, (isCurrent || planIsLocked) && styles.disabledAction]}
                      onPress={() => plan.plan_key !== "trial" && void startMerchantSubscription(plan.plan_key)}
                      disabled={busy || isCurrent || planIsLocked}
                      accessibilityRole="button"
                    >
                      <Text style={styles.primaryButtonText}>
                        {isCurrent ? "Current plan" : planIsLocked ? "Contact support to change plan" : merchantSubscription?.plan_key === plan.plan_key && merchantSubscription.status === "trialing"
                          ? "Set up after trial"
                          : "Choose plan"}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
              <Pressable style={styles.secondaryButton} onPress={() => void run(() => loadWorkspace(session!.user.id))} disabled={busy} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>Refresh subscription status</Text>
              </Pressable>
              <Text style={styles.growthFootnote}>Secure Razorpay authorization opens in your browser. The subscription starts after the trial; authorization and webhook setup are required.</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Team access · Advanced and trial</Text>
              <Text style={styles.growthNote}>Add an existing KiranaLink account as a manager or staff member. Team members can work with this shop’s catalogue and orders; they cannot change its owner, billing or store settings.</Text>
              <Field label="Team member account email" value={staffEmail} onChangeText={setStaffEmail} placeholder="name@example.com" />
              <Pressable
                style={[styles.primaryButton, !hasAdvancedAccess && styles.disabledAction]}
                onPress={() => void addStaffMember()}
                disabled={busy || !hasAdvancedAccess}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>{hasAdvancedAccess ? "Add team member" : "Available with Advanced or during trial"}</Text>
              </Pressable>
              {shopMembers.map((member) => (
                <View key={member.user_id} style={styles.growthListItem}>
                  <View style={styles.growthListCopy}>
                    <Text style={styles.growthListTitle}>{member.full_name || member.phone || `Team member ${member.user_id.slice(0, 8)}`}</Text>
                    <Text style={styles.growthNote}>{member.member_role.toUpperCase()}</Text>
                  </View>
                  {member.member_role !== "owner" ? (
                    <Pressable onPress={() => void removeStaffMember(member.user_id)} disabled={busy} accessibilityRole="button">
                      <Text style={styles.cancelText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Promote your shop or product</Text>
              <Text style={styles.growthNote}>₹599 for 7 days, then prorated by duration. Payment is hosted by Razorpay; sponsored placements are labeled for customers.</Text>
              <Text style={styles.fieldLabel}>Placement</Text>
              <View style={styles.choiceRow}>
                {([
                  ["store", "Promote my shop"],
                  ["product", "Promote a product"],
                ] as const).map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.choice, adTargetType === value && styles.choiceSelected]}
                    onPress={() => setAdTargetType(value)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.choiceText, adTargetType === value && styles.choiceTextSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {adTargetType === "product" ? (
                <View>
                  <Text style={styles.fieldLabel}>Available product</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                    {catalog.filter((item) => item.inventory.is_available && item.inventory.available_quantity > 0).map((item) => (
                      <Pressable
                        key={item.product.id}
                        style={[styles.categoryChip, (adProductId ?? catalog[0]?.product.id) === item.product.id && styles.categoryChipSelected]}
                        onPress={() => setAdProductId(item.product.id)}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.categoryChipText, (adProductId ?? catalog[0]?.product.id) === item.product.id && styles.categoryChipTextSelected]}>{item.product.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              <Field label="Duration (days, 7–365)" value={adDurationDays} onChangeText={setAdDurationDays} keyboardType="number-pad" />
              <Text style={styles.growthNote}>
                Estimated price: {Number.isInteger(Number(adDurationDays)) && Number(adDurationDays) >= 7 && Number(adDurationDays) <= 365
                  ? money(Math.ceil(59900 * Number(adDurationDays) / 7))
                  : "enter 7–365 days"} · final amount is calculated by the server
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => void createAd()} disabled={busy || !shop.is_active} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>{shop.is_active ? "Create campaign and pay" : "Publish your shop to advertise"}</Text>
              </Pressable>
              {adCampaigns.length > 0 ? <Text style={styles.formLabel}>Campaign history</Text> : null}
              {adCampaigns.map((campaign) => (
                <View key={campaign.id} style={styles.growthListItem}>
                  <View style={styles.growthListCopy}>
                    <Text style={styles.growthListTitle}>{campaign.target_type === "store" ? "Shop promotion" : "Product promotion"} · {campaign.duration_days} days</Text>
                    <Text style={styles.growthNote}>{money(campaign.amount_paise)} · {campaign.status.replace(/_/g, " ")}</Text>
                    {campaign.ends_at ? <Text style={styles.growthNote}>Ends {new Date(campaign.ends_at).toLocaleDateString()}</Text> : null}
                  </View>
                  {campaign.status === "pending_payment" ? (
                    <Pressable style={styles.smallAction} onPress={() => void openAdPayment(campaign.id)} disabled={busy} accessibilityRole="button">
                      <Text style={styles.smallActionText}>Pay</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Create a product pool</Text>
              <Text style={styles.growthNote}>Set one product, a target quantity, a discounted unit price and a deadline. Stock is reserved only after the target is met. Customers pay through your existing cash/UPI order flow after an order is created.</Text>
              <Text style={styles.fieldLabel}>Product</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                {catalog.filter((item) => item.inventory.is_available && item.inventory.available_quantity > 0).map((item) => (
                  <Pressable
                    key={item.product.id}
                    style={[styles.categoryChip, (poolProductId ?? catalog.find((row) => row.inventory.is_available && row.inventory.available_quantity > 0)?.product.id) === item.product.id && styles.categoryChipSelected]}
                    onPress={() => {
                      setPoolProductId(item.product.id);
                      setPoolUnitPrice("");
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.categoryChipText, (poolProductId ?? catalog.find((row) => row.inventory.is_available && row.inventory.available_quantity > 0)?.product.id) === item.product.id && styles.categoryChipTextSelected]}>{item.product.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.formRow}>
                <Field rowField label="Target units (min 2)" value={poolTargetQuantity} onChangeText={setPoolTargetQuantity} keyboardType="decimal-pad" />
                <Field rowField label="Pooled unit price (₹)" value={poolUnitPrice} onChangeText={setPoolUnitPrice} keyboardType="decimal-pad" />
              </View>
              <Field label="Deadline in hours (1–720)" value={poolDeadlineHours} onChangeText={setPoolDeadlineHours} keyboardType="number-pad" />
              <Pressable style={styles.primaryButton} onPress={() => void createPool()} disabled={busy || !shop.is_active} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>{shop.is_active ? "Publish product pool" : "Publish your shop to create a pool"}</Text>
              </Pressable>
              {productPools.length > 0 ? <Text style={styles.formLabel}>Product pools</Text> : null}
              {productPools.map((pool) => (
                <View key={pool.id} style={styles.growthListItem}>
                  <View style={styles.growthListCopy}>
                    <Text style={styles.growthListTitle}>{pool.product_name_snapshot} · {pool.status.toUpperCase()}</Text>
                    <Text style={styles.growthNote}>{pool.joined_quantity} / {pool.target_quantity} {pool.unit_label_snapshot} · {money(pool.pool_unit_price_paise)} per unit</Text>
                    <Text style={styles.growthNote}>Deadline {new Date(pool.ends_at).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
              {productPools.length === 0 ? <Text style={styles.growthNote}>No product pools have been created yet.</Text> : null}
            </View>
          </View>
        ) : null}

        {shop && tab === "products" ? (
          <View>
            <View style={styles.sectionHeader}>
              <View><Text style={styles.sectionTitle}>Products and stock</Text><Text style={styles.sectionSubtitle}>Prices are per unit and shown in INR.</Text></View>
              <Pressable style={styles.addButton} onPress={resetProductForm} accessibilityRole="button"><Text style={styles.addButtonText}>＋</Text></Pressable>
            </View>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{editingItem ? "Edit shop inventory" : "Add a product"}</Text>
              <Field label="Product name" value={productName} onChangeText={setProductName} placeholder="e.g. Farm fresh tomatoes" editable={canEditProductDetails} />
              {canEditProductDetails ? <Field label="Description" value={productDescription} onChangeText={setProductDescription} placeholder="Optional details" /> : null}
              {canEditProductDetails ? (
                <View style={styles.imagePickerRow}>
                  {productImage ? (
                    <Image source={{ uri: productImage.uri }} style={styles.productImagePreview} />
                  ) : productImagePath ? (
                    <Image source={{ uri: client.storage.from("product-images").getPublicUrl(productImagePath).data.publicUrl }} style={styles.productImagePreview} />
                  ) : (
                    <View style={styles.productImagePlaceholder}><Ionicons name="image-outline" size={23} color={colors.green} /></View>
                  )}
                  <View style={styles.imagePickerCopy}>
                    <Text style={styles.quickTitle}>Product photo</Text>
                    <Text style={styles.quickDetail}>JPEG, PNG or WebP · up to 5 MB</Text>
                    <Pressable style={styles.imagePickerButton} onPress={() => void chooseProductImage()} disabled={busy} accessibilityRole="button">
                      <Ionicons name="cloud-upload-outline" size={16} color={colors.green} />
                      <Text style={styles.imagePickerButtonText}>{productImage || productImagePath ? "Change photo" : "Choose photo"}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                <Pressable
                  style={[styles.categoryChip, !selectedCategoryId && styles.categoryChipSelected]}
                  onPress={() => canEditProductDetails && setSelectedCategoryId(null)}
                  disabled={!canEditProductDetails}
                  accessibilityRole="button"
                >
                  <Text style={[styles.categoryChipText, !selectedCategoryId && styles.categoryChipTextSelected]}>Uncategorized</Text>
                </Pressable>
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    style={[styles.categoryChip, selectedCategoryId === category.id && styles.categoryChipSelected]}
                    onPress={() => canEditProductDetails && setSelectedCategoryId(category.id)}
                    disabled={!canEditProductDetails}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.categoryChipText, selectedCategoryId === category.id && styles.categoryChipTextSelected]}>{category.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {!canEditProductDetails ? <Text style={styles.categoryHint}>Shared catalogue details are managed by the product creator; you can update your shop’s price and stock.</Text> : null}
              <View style={styles.formRow}>
                <Field rowField label="Unit" value={productUnit} onChangeText={setProductUnit} placeholder="kg, piece, pack" />
                <Field rowField label="Price (₹)" value={productPrice} onChangeText={setProductPrice} placeholder="0.00" keyboardType="decimal-pad" />
              </View>
              <View style={styles.formRow}>
                <Field rowField label="Stock" value={productQuantity} onChangeText={setProductQuantity} placeholder="0" keyboardType="decimal-pad" />
                <Field rowField label="Low stock at" value={lowStock} onChangeText={setLowStock} placeholder="5" keyboardType="decimal-pad" />
              </View>
              <Pressable style={styles.toggleRow} onPress={() => setProductAvailable((value) => !value)} accessibilityRole="button" accessibilityState={{ checked: productAvailable }}>
                <Text style={styles.toggleLabel}>Available to customers</Text>
                <Text style={[styles.toggleValue, productAvailable && styles.toggleValueOn]}>{productAvailable ? "YES" : "NO"}</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => void saveProduct()} disabled={busy} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>{editingItem ? "Save inventory" : "Add product"}</Text>
              </Pressable>
              {editingItem ? <Pressable style={styles.cancelEdit} onPress={resetProductForm}><Text style={styles.cancelEditText}>Cancel edit</Text></Pressable> : null}
            </View>
            {catalog.map((item) => (
              <Pressable key={item.inventory.id} style={styles.productRow} onPress={() => editProduct(item)} accessibilityRole="button">
                {item.product.image_path ? (
                  <Image source={{ uri: client.storage.from("product-images").getPublicUrl(item.product.image_path).data.publicUrl }} style={styles.productIcon} />
                ) : (
                  <View style={styles.productIcon}><Ionicons name="leaf-outline" size={19} color={colors.amber} /></View>
                )}
                <View style={styles.productCopy}>
                  <Text style={styles.productName}>{item.product.name}</Text>
                  <Text style={styles.productMeta}>{item.inventory.available_quantity} {item.product.unit_label} · {item.inventory.is_available ? "Available" : "Hidden"}</Text>
                </View>
                <Text style={styles.productPrice}>{money(item.inventory.selling_price_paise)}</Text>
              </Pressable>
            ))}
            {catalog.length === 0 ? <EmptyState title="Your catalogue is empty" body="Add your first product and keep its price and stock current." /> : null}
          </View>
        ) : null}

        {shop && tab === "orders" ? (
          <View>
            <Text style={styles.sectionTitle}>Customer orders</Text>
            {orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHead}>
                  <View><Text style={styles.orderTitle}>Order {order.order_number}</Text><Text style={styles.orderSub}>{new Date(order.created_at).toLocaleString()} · {order.fulfillment_type}</Text></View>
                  <Text style={styles.statusBadge}>{order.status.replace(/_/g, " ").toUpperCase()}</Text>
                </View>
                {order.items.map((item) => <Text key={item.id} style={styles.orderItem}>{item.quantity} × {item.product_name_snapshot} · {money(item.line_total_paise)}</Text>)}
                <View style={styles.orderTotal}><Text style={styles.orderItem}>Total</Text><Text style={styles.productPrice}>{money(order.total_paise)}</Text></View>
                <Text style={styles.paymentLine}>Payment: {order.payment_method?.toUpperCase()} · {order.payment_status.toUpperCase()}</Text>
                {order.payment_method === "upi" && order.payment_status === "submitted" ? (
                  <View style={styles.paymentReview}>
                    <Text style={styles.paymentReference}>UPI reference: {order.payment_reference}</Text>
                    <Field label="Review note (optional)" value={upiReviewNotes[order.id] ?? ""} onChangeText={(value) => setUpiReviewNotes((current) => ({ ...current, [order.id]: value }))} placeholder="Reason if rejecting" />
                    <View style={styles.buttonRow}>
                      <Pressable style={styles.primaryButtonSmall} onPress={() => void run(async () => { await reviewPayment(client, order.id, true, upiReviewNotes[order.id]); await loadWorkspace(session.user.id); })} disabled={busy}>
                        <Text style={styles.primaryButtonText}>Verify payment</Text>
                      </Pressable>
                      <Pressable style={styles.rejectButton} onPress={() => void run(async () => { await reviewPayment(client, order.id, false, upiReviewNotes[order.id]); await loadWorkspace(session.user.id); })} disabled={busy}>
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                {order.payment_method === "cash" && order.payment_status === "pending" && order.status === "delivered" ? (
                  <Pressable style={styles.secondaryButton} onPress={() => void run(async () => { await markCashOrderPaid(client, order.id); await loadWorkspace(session.user.id); })} disabled={busy}>
                    <Text style={styles.secondaryButtonText}>Record cash received</Text>
                  </Pressable>
                ) : null}
                <OrderActions order={order} disabled={busy} onAction={(nextStatus) => void processOrder(order, nextStatus)} />
              </View>
            ))}
            {orders.length === 0 ? <EmptyState title="No orders yet" body="New customer orders will appear here when the shop is live." /> : null}
          </View>
        ) : null}

        {shop && tab === "reports" ? (
          <View>
            <Text style={styles.sectionTitle}>{hasAdvancedAccess ? "Advanced business reports" : "Business reports"}</Text>
            <Text style={styles.sectionSubtitle}>
              {hasAdvancedAccess
                ? "Choose a date range of up to 366 days for order and sales totals."
                : "Today’s totals from the secure retailer summary. Date-range reporting is included with Advanced and the active trial."}
            </Text>
            {hasAdvancedAccess ? (
              <>
                <View style={styles.formRow}>
                  <Field rowField label="From (YYYY-MM-DD)" value={reportFrom} onChangeText={setReportFrom} placeholder="2026-01-01" />
                  <Field rowField label="To (YYYY-MM-DD)" value={reportTo} onChangeText={setReportTo} placeholder="2026-01-31" />
                </View>
                <Pressable style={styles.primaryButton} onPress={() => void runAdvancedReport()} disabled={busy} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Run date-range report</Text>
                </Pressable>
              </>
            ) : null}
            <View style={styles.reportCard}>
              <ReportMetric label={hasAdvancedAccess ? "Orders in range" : "Orders today"} value={String((hasAdvancedAccess ? reportSummary : summary)?.order_count ?? 0)} />
              <ReportMetric label="Gross sales" value={money((hasAdvancedAccess ? reportSummary : summary)?.gross_sales_paise ?? 0)} />
              <ReportMetric label="Pending orders" value={String((hasAdvancedAccess ? reportSummary : summary)?.pending_orders ?? 0)} />
              <ReportMetric label="Low-stock items" value={String((hasAdvancedAccess ? reportSummary : summary)?.low_stock_items ?? 0)} />
            </View>
            <Text style={styles.reportDisclaimer}>Sales exclude cancelled/rejected orders. Payment reconciliation and downloadable reports are not enabled in this build.</Text>
          </View>
        ) : null}

        {shop && tab === "support" ? (
          <View>
            <Text style={styles.sectionTitle}>Customer support</Text>
            {tickets.map((ticket) => (
              <Pressable key={ticket.id} style={styles.ticketCard} onPress={() => setSelectedTicketId((current) => current === ticket.id ? null : ticket.id)} accessibilityRole="button">
                <View style={styles.orderHead}><Text style={styles.orderTitle}>{ticket.subject}</Text><Text style={styles.statusBadge}>{ticket.status.toUpperCase()}</Text></View>
                <Text style={styles.orderSub}>Updated {new Date(ticket.updated_at).toLocaleString()}</Text>
                {selectedTicketId === ticket.id ? (
                  <View style={styles.ticketThread}>
                    {messages.map((message) => <Text key={message.id} style={styles.threadMessage}>{message.message}</Text>)}
                    <Field label="Reply" value={supportReply} onChangeText={setSupportReply} placeholder="Write a helpful response" multiline />
                    <Pressable style={styles.secondaryButton} onPress={() => void submitSupportReply()} disabled={busy}><Text style={styles.secondaryButtonText}>Send reply</Text></Pressable>
                    <Pressable
                      style={styles.resolveButton}
                      onPress={() => void run(async () => {
                        await setSupportTicketStatus(client, ticket.id, ticket.status !== "resolved");
                        setTickets(await getSupportTickets(client, { shopId: shop!.id }));
                      })}
                      disabled={busy}
                    >
                      <Text style={styles.resolveButtonText}>{ticket.status === "resolved" ? "Reopen request" : "Mark resolved"}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            ))}
            {tickets.length === 0 ? <EmptyState title="No support requests" body="Customer support tickets linked to your shop will appear here." /> : null}
          </View>
        ) : null}

        {shop && tab === "store" ? (
          <ShopForm
            title="Store details"
            subtitle="Keep your location, hours and fulfilment options accurate."
            shopName={shopName} setShopName={setShopName}
            shopDescription={shopDescription} setShopDescription={setShopDescription}
            shopPhone={shopPhone} setShopPhone={setShopPhone}
            shopAddress={shopAddress} setShopAddress={setShopAddress}
            shopLocality={shopLocality} setShopLocality={setShopLocality}
            shopCity={shopCity} setShopCity={setShopCity}
            shopState={shopState} setShopState={setShopState}
            shopPostalCode={shopPostalCode} setShopPostalCode={setShopPostalCode}
            pickupEnabled={pickupEnabled} setPickupEnabled={setPickupEnabled}
            deliveryEnabled={deliveryEnabled} setDeliveryEnabled={setDeliveryEnabled}
            deliveryFee={deliveryFee} setDeliveryFee={setDeliveryFee}
            minimumOrder={minimumOrder} setMinimumOrder={setMinimumOrder}
            openingTime={openingTime} setOpeningTime={setOpeningTime}
            closingTime={closingTime} setClosingTime={setClosingTime}
            upiId={upiId} setUpiId={setUpiId}
            onSave={() => void saveShop()} busy={busy}
          />
        ) : null}

        {shop ? (
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
        ) : null}
      </ScrollView>

      {shop ? (
        <View style={styles.tabBar}>
          {([
            ["overview", "home-outline", "Home"],
            ["products", "cube-outline", "Products"],
            ["orders", "receipt-outline", "Orders"],
            ["reports", "bar-chart-outline", "Reports"],
            ["growth", "trending-up-outline", "Growth"],
            ["support", "chatbubbles-outline", "Support"],
            ["store", "storefront-outline", "Store"],
          ] as const).filter(([key]) => isShopOwner || (key !== "growth" && key !== "store")).map(([key, icon, label]) => (
            <Pressable key={key} style={[styles.tabItem, tab === key && styles.tabItemSelected]} onPress={() => {
              if (key === "store") fillShopForm(shop);
              setTab(key);
            }} accessibilityRole="button" accessibilityState={{ selected: tab === key }}>
              <Ionicons name={icon} size={21} color={tab === key ? colors.green : colors.muted} />
              <Text style={[styles.tabLabel, tab === key && styles.tabLabelSelected]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ShopForm(props: {
  title: string;
  subtitle: string;
  shopName: string; setShopName: (value: string) => void;
  shopDescription: string; setShopDescription: (value: string) => void;
  shopPhone: string; setShopPhone: (value: string) => void;
  shopAddress: string; setShopAddress: (value: string) => void;
  shopLocality: string; setShopLocality: (value: string) => void;
  shopCity: string; setShopCity: (value: string) => void;
  shopState: string; setShopState: (value: string) => void;
  shopPostalCode: string; setShopPostalCode: (value: string) => void;
  pickupEnabled: boolean; setPickupEnabled: (value: boolean) => void;
  deliveryEnabled: boolean; setDeliveryEnabled: (value: boolean) => void;
  deliveryFee: string; setDeliveryFee: (value: string) => void;
  minimumOrder: string; setMinimumOrder: (value: string) => void;
  openingTime: string; setOpeningTime: (value: string) => void;
  closingTime: string; setClosingTime: (value: string) => void;
  upiId: string; setUpiId: (value: string) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 480;

  return (
    <View>
      <View style={styles.formIntro}><Text style={styles.formIntroTitle}>{props.title}</Text><Text style={styles.formIntroBody}>{props.subtitle}</Text></View>
      <View style={styles.formCard}>
        <Text style={styles.formSectionLabel}>Business profile</Text>
        <Field label="Shop name *" value={props.shopName} onChangeText={props.setShopName} placeholder="Your store name" />
        <Field label="About your shop" value={props.shopDescription} onChangeText={props.setShopDescription} placeholder="What makes your shop special?" multiline />
        <Field label="Shop phone" value={props.shopPhone} onChangeText={props.setShopPhone} placeholder="Phone number" keyboardType="phone-pad" />

        <Text style={styles.formSectionLabel}>Location</Text>
        <Field label="Address" value={props.shopAddress} onChangeText={props.setShopAddress} placeholder="Street address" />
        <Field label="Locality" value={props.shopLocality} onChangeText={props.setShopLocality} placeholder="Neighbourhood" />
        <View style={[styles.shopFormRow, compact && styles.shopFormRowStacked]}>
          <Field rowField stacked={compact} label="City *" value={props.shopCity} onChangeText={props.setShopCity} placeholder="City" />
          <Field rowField stacked={compact} label="State *" value={props.shopState} onChangeText={props.setShopState} placeholder="State" />
        </View>
        <Field label="Postal code" value={props.shopPostalCode} onChangeText={props.setShopPostalCode} placeholder="Postal code" keyboardType="number-pad" />

        <Text style={styles.formSectionLabel}>Fulfilment</Text>
        <ChoiceToggle label="Customer pickup" value={props.pickupEnabled} onPress={() => props.setPickupEnabled(!props.pickupEnabled)} />
        <ChoiceToggle label="Local delivery" value={props.deliveryEnabled} onPress={() => props.setDeliveryEnabled(!props.deliveryEnabled)} />
        {props.deliveryEnabled ? (
          <View style={[styles.shopFormRow, compact && styles.shopFormRowStacked]}>
            <Field rowField stacked={compact} label="Delivery fee (₹)" value={props.deliveryFee} onChangeText={props.setDeliveryFee} placeholder="0" keyboardType="decimal-pad" />
            <Field rowField stacked={compact} label="Minimum order (₹)" value={props.minimumOrder} onChangeText={props.setMinimumOrder} placeholder="0" keyboardType="decimal-pad" />
          </View>
        ) : null}
        <Field label="UPI ID for manual payments (optional)" value={props.upiId} onChangeText={props.setUpiId} placeholder="yourshop@bank" />

        <Text style={styles.formSectionLabel}>Opening hours · 24-hour time</Text>
        <View style={[styles.shopFormRow, compact && styles.shopFormRowStacked]}>
          <Field rowField stacked={compact} label="Opens" value={props.openingTime} onChangeText={props.setOpeningTime} placeholder="09:00:00" />
          <Field rowField stacked={compact} label="Closes" value={props.closingTime} onChangeText={props.setClosingTime} placeholder="21:00:00" />
        </View>
        <Pressable style={styles.primaryButton} onPress={props.onSave} disabled={props.busy} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Save shop details</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad" | "phone-pad";
  multiline?: boolean;
  editable?: boolean;
  rowField?: boolean;
  stacked?: boolean;
}) {
  return (
    <View style={[
      styles.field,
      props.rowField && styles.rowField,
      props.stacked && styles.stackedRowField,
    ]}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.multilineInput, props.editable === false && styles.inputLocked]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={props.keyboardType ?? "default"}
        multiline={props.multiline}
        editable={props.editable}
      />
    </View>
  );
}

function ChoiceToggle({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={onPress} accessibilityRole="button" accessibilityState={{ checked: value }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Text style={[styles.toggleValue, value && styles.toggleValueOn]}>{value ? "ON" : "OFF"}</Text>
    </Pressable>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

function QuickLink({ icon, title, detail, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickLink} onPress={onPress} accessibilityRole="button">
      <View style={styles.quickLinkIcon}><Ionicons name={icon} size={19} color={colors.green} /></View>
      <View style={styles.quickLinkCopy}><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickDetail}>{detail}</Text></View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.reportMetric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.reportValue}>{value}</Text></View>;
}

function OrderActions({ order, disabled, onAction }: { order: OrderWithItems; disabled: boolean; onAction: (status: OrderStatus) => void }) {
  const actions: { label: string; status: OrderStatus }[] = order.status === "placed"
    ? order.payment_status === "submitted" || order.payment_status === "paid"
      ? [{ label: "Accept", status: "accepted" }]
      : [{ label: "Accept", status: "accepted" }, { label: "Reject order", status: "rejected" }]
    : order.status === "accepted"
      ? [{ label: "Start packing", status: "packing" }]
      : order.status === "packing"
        ? order.fulfillment_type === "pickup"
          ? [{ label: "Ready for pickup", status: "ready_for_pickup" }]
          : [{ label: "Out for delivery", status: "out_for_delivery" }]
        : order.status === "ready_for_pickup" || order.status === "out_for_delivery"
          ? [{ label: "Mark delivered", status: "delivered" }]
          : [];
  return actions.length ? (
    <View style={styles.buttonRow}>
      {actions.map((action, index) => (
        <Pressable
          key={action.status}
          style={index === 0 ? styles.primaryButtonSmall : styles.rejectButton}
          onPress={() => onAction(action.status)}
          disabled={disabled}
          accessibilityRole="button"
        >
          <Text style={index === 0 ? styles.primaryButtonText : styles.rejectButtonText}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  ) : null;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.emptyState}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

function LoadingScreen() {
  return <View style={styles.loading}><ActivityIndicator color={colors.green} /><Text style={styles.loadingText}>Connecting to your shop…</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topbar: { width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 19, paddingTop: 10, paddingBottom: 13 },
  topbarCopy: { flex: 1, minWidth: 0 },
  topEyebrow: { color: colors.green, fontWeight: "900", fontSize: 8, letterSpacing: 1, marginBottom: 3 },
  topTitle: { color: colors.ink, fontWeight: "900", fontSize: 20, flexShrink: 1 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.orangeSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6 },
  liveBadgeActive: { backgroundColor: colors.greenSoft },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange },
  liveDotActive: { backgroundColor: colors.green },
  liveText: { color: colors.amber, fontSize: 8, fontWeight: "900" },
  liveTextActive: { color: colors.greenDark },
  loader: { marginVertical: 5 },
  errorBanner: { backgroundColor: colors.redSoft, color: colors.red, fontSize: 11, lineHeight: 16, paddingHorizontal: 15, paddingVertical: 9, marginHorizontal: 16, borderRadius: 10 },
  successBanner: { width: "92%", maxWidth: 1080, alignSelf: "center", backgroundColor: colors.greenSoft, color: colors.greenDark, fontSize: 10, lineHeight: 15, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 10 },
  switchAccountButton: { width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, paddingHorizontal: 19, paddingVertical: 7 },
  switchAccountText: { color: colors.green, fontSize: 10, fontWeight: "800" },
  content: { width: "100%", maxWidth: 1120, alignSelf: "center", padding: 17, paddingBottom: 28 },
  hero: { backgroundColor: colors.green, borderRadius: 22, padding: 19, marginBottom: 13 },
  growthHero: { backgroundColor: colors.green, borderRadius: 22, padding: 19, marginBottom: 13 },
  heroKicker: { color: colors.lime, fontWeight: "900", letterSpacing: 1, fontSize: 8, marginBottom: 10 },
  heroTitle: { color: colors.surface, fontSize: 23, lineHeight: 28, fontWeight: "900", marginBottom: 7 },
  heroBody: { color: "#E4EFE6", fontSize: 10, lineHeight: 16, marginBottom: 15 },
  heroButton: { backgroundColor: colors.lime, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  heroButtonDisabled: { opacity: 0.55 },
  heroButtonText: { color: colors.greenDark, fontSize: 10, fontWeight: "900" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 9, marginBottom: 13 },
  metric: { width: "48.5%", borderRadius: 14, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  metricLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  metricValue: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 7 },
  metricDetail: { color: colors.muted, fontSize: 8, marginTop: 3 },
  quickLinks: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, paddingHorizontal: 12 },
  quickLink: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  quickLinkIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", marginRight: 10 },
  quickLinkCopy: { flex: 1 },
  quickTitle: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  quickDetail: { color: colors.muted, fontSize: 9, marginTop: 3 },
  chevron: { color: colors.muted, fontSize: 22 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 5 },
  sectionSubtitle: { color: colors.muted, fontSize: 9, lineHeight: 14, marginBottom: 11 },
  addButton: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  addButtonText: { color: colors.surface, fontSize: 19, fontWeight: "800", marginTop: -2 },
  formIntro: { backgroundColor: colors.greenSoft, borderRadius: 17, padding: 16, marginBottom: 12 },
  formIntroTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: 5 },
  formIntroBody: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  formCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 13, marginBottom: 13 },
  formTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginBottom: 11 },
  growthPlanName: { color: colors.ink, fontSize: 13, fontWeight: "900", marginBottom: 4 },
  planPrice: { color: colors.greenDark, fontSize: 15, fontWeight: "900" },
  growthNote: { color: colors.muted, fontSize: 9, lineHeight: 14, marginBottom: 8 },
  growthWarning: { color: colors.red, backgroundColor: colors.redSoft, fontSize: 9, lineHeight: 14, padding: 9, borderRadius: 10, marginVertical: 8 },
  growthFootnote: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 9 },
  planCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 11, marginTop: 8 },
  planHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  disabledAction: { opacity: 0.55 },
  cancelConfirm: { backgroundColor: colors.redSoft, borderRadius: 11, padding: 10, marginTop: 8 },
  cancelConfirmButton: { flex: 1, minHeight: 38, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dangerButton: { flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: colors.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  dangerButtonText: { color: colors.surface, fontSize: 9, fontWeight: "900", textAlign: "center" },
  cancelButton: { alignSelf: "flex-start", paddingVertical: 8, marginTop: 5 },
  cancelText: { color: colors.red, fontSize: 9, fontWeight: "800" },
  growthListItem: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingVertical: 10 },
  growthListCopy: { flex: 1 },
  growthListTitle: { color: colors.ink, fontSize: 10, fontWeight: "800", marginBottom: 3 },
  smallAction: { minHeight: 32, minWidth: 48, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  smallActionText: { color: colors.greenDark, fontSize: 9, fontWeight: "900" },
  field: { marginBottom: 9 },
  fieldLabel: { color: colors.muted, fontSize: 8, fontWeight: "800", marginBottom: 4 },
  formLabel: { color: colors.ink, fontSize: 10, fontWeight: "800", marginTop: 11, marginBottom: 7 },
  choiceRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  choice: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.line, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  choiceSelected: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  choiceText: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  choiceTextSelected: { color: colors.greenDark },
  input: { minHeight: 39, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FBFCFA", borderRadius: 10, paddingHorizontal: 10, color: colors.ink, fontSize: 10 },
  inputLocked: { color: colors.muted, backgroundColor: "#F1F3EE" },
  multilineInput: { minHeight: 67, textAlignVertical: "top", paddingTop: 9 },
  formRow: { flexDirection: "row", gap: 8 },
  shopFormRow: { flexDirection: "row", gap: 10 },
  shopFormRowStacked: { flexDirection: "column", gap: 0 },
  rowField: { flex: 1, minWidth: 0 },
  stackedRowField: { flex: 0, width: "100%" },
  imagePickerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  productImagePreview: { width: 66, height: 66, borderRadius: 14, backgroundColor: colors.greenSoft },
  productImagePlaceholder: { width: 66, height: 66, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  imagePickerCopy: { flex: 1 },
  imagePickerButton: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 7, paddingVertical: 5 },
  imagePickerButtonText: { color: colors.green, fontWeight: "800", fontSize: 10 },
  categoryList: { gap: 7, paddingBottom: 8 },
  categoryChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 10 },
  categoryChipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  categoryChipText: { color: colors.muted, fontSize: 8, fontWeight: "800" },
  categoryChipTextSelected: { color: colors.surface },
  categoryHint: { color: colors.muted, fontSize: 8, lineHeight: 12, marginBottom: 8 },
  formSectionLabel: { color: colors.ink, fontSize: 10, fontWeight: "900", marginTop: 6, marginBottom: 7 },
  formSectionLabelRow: { marginTop: 5 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FAFBF8", borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 10, marginBottom: 7 },
  toggleLabel: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  toggleValue: { color: colors.muted, fontSize: 8, fontWeight: "900" },
  toggleValueOn: { color: colors.green },
  primaryButton: { minHeight: 42, borderRadius: 11, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, marginTop: 4 },
  primaryButtonText: { color: colors.surface, fontSize: 9, fontWeight: "900", textAlign: "center" },
  cancelEdit: { alignItems: "center", padding: 10 },
  cancelEditText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  productRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 10, marginBottom: 7 },
  productIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.orangeSoft, alignItems: "center", justifyContent: "center" },
  productIconText: { color: colors.amber, fontWeight: "900", fontSize: 15 },
  productCopy: { flex: 1, marginLeft: 9 },
  productName: { color: colors.ink, fontWeight: "800", fontSize: 10 },
  productMeta: { color: colors.muted, fontSize: 8, marginTop: 4 },
  productPrice: { color: colors.ink, fontWeight: "900", fontSize: 10 },
  orderCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 12, marginBottom: 10 },
  orderHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 },
  orderTitle: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  orderSub: { color: colors.muted, fontSize: 8, marginTop: 3 },
  statusBadge: { color: colors.greenDark, backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 5, fontSize: 7, fontWeight: "900", overflow: "hidden" },
  orderItem: { color: colors.muted, fontSize: 9, marginVertical: 3 },
  orderTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7, marginTop: 5 },
  paymentLine: { color: colors.muted, fontSize: 8, marginTop: 8, marginBottom: 6 },
  paymentReview: { backgroundColor: colors.orangeSoft, borderRadius: 12, padding: 10, marginTop: 6 },
  paymentReference: { color: colors.ink, fontSize: 9, fontWeight: "800", marginBottom: 8 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  primaryButtonSmall: { flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  rejectButton: { flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: colors.redSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  rejectButtonText: { color: colors.red, fontSize: 9, fontWeight: "900" },
  secondaryButton: { minHeight: 38, borderWidth: 1, borderColor: colors.green, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 8 },
  secondaryButtonText: { color: colors.green, fontSize: 9, fontWeight: "900" },
  resolveButton: { alignItems: "center", paddingVertical: 9 },
  resolveButtonText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  reportCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, paddingHorizontal: 13 },
  reportMetric: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  reportValue: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 5 },
  reportDisclaimer: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 10 },
  ticketCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, marginBottom: 8 },
  ticketThread: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 10 },
  threadMessage: { color: colors.ink, fontSize: 10, lineHeight: 16, backgroundColor: colors.greenSoft, borderRadius: 10, padding: 9, marginBottom: 7 },
  emptyState: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 18, alignItems: "center", marginVertical: 10 },
  emptyTitle: { color: colors.ink, fontSize: 12, fontWeight: "900", textAlign: "center" },
  emptyBody: { color: colors.muted, fontSize: 9, lineHeight: 15, textAlign: "center", marginTop: 6 },
  signOutButton: { alignItems: "center", padding: 13 },
  signOutText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  tabBar: { flexDirection: "row", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, paddingBottom: 4 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 7, borderRadius: 12, marginHorizontal: 1 },
  tabItemSelected: { backgroundColor: colors.greenSoft },
  tabLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  tabLabelSelected: { color: colors.green, fontWeight: "900" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  loadingText: { color: colors.muted, fontSize: 10, marginTop: 10 },
});
