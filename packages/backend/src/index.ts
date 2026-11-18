import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus =
  | "placed"
  | "accepted"
  | "packing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "rejected";

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<{
        id: string;
        full_name: string | null;
        phone: string | null;
        role: "customer" | "retailer" | "admin";
        preferred_language: string;
      }>;
      shops: Table<{
        id: string;
        owner_id: string;
        name: string;
        description: string | null;
        phone: string | null;
        address_line: string | null;
        locality: string | null;
        city: string;
        state: string;
        postal_code: string | null;
        is_active: boolean;
        pickup_enabled: boolean;
        delivery_enabled: boolean;
        delivery_fee_paise: number;
        minimum_order_paise: number;
        opening_time: string | null;
        closing_time: string | null;
        support_phone: string | null;
        upi_id: string | null;
      }>;
      shop_members: Table<{
        shop_id: string;
        user_id: string;
        member_role: "owner" | "manager" | "staff";
        created_at: string;
      }>;
      categories: Table<{
        id: string;
        name: string;
        slug: string;
        sort_order: number;
        is_active: boolean;
      }>;
      products: Table<{
        id: string;
        name: string;
        description: string | null;
        category_id: string | null;
        brand: string | null;
        unit_label: string;
        image_path: string | null;
        is_active: boolean;
        created_by: string | null;
      }>;
      inventory: Table<{
        id: string;
        shop_id: string;
        product_id: string;
        selling_price_paise: number;
        available_quantity: number;
        low_stock_threshold: number;
        is_available: boolean;
        updated_at: string;
      }>;
      addresses: Table<{
        id: string;
        customer_id: string;
        label: string | null;
        recipient_name: string;
        phone: string;
        address_line: string;
        locality: string | null;
        city: string;
        state: string;
        postal_code: string | null;
        is_default: boolean;
      }>;
      carts: Table<{
        id: string;
        customer_id: string;
        shop_id: string;
        updated_at: string;
      }>;
      cart_items: Table<{
        id: string;
        cart_id: string;
        inventory_id: string;
        quantity: number;
      }>;
      orders: Table<{
        id: string;
        order_number: number;
        customer_id: string;
        shop_id: string;
        address_id: string | null;
        status: OrderStatus;
        fulfillment_type: "pickup" | "delivery";
        subtotal_paise: number;
        delivery_fee_paise: number;
        total_paise: number;
        payment_method: "cash" | "upi" | null;
        payment_status: "pending" | "submitted" | "paid" | "rejected" | "refunded";
        payment_reference: string | null;
        payment_verified_by: string | null;
        payment_verified_at: string | null;
        upi_id_snapshot: string | null;
        customer_note: string | null;
        created_at: string;
        updated_at: string;
      }>;
      order_items: Table<{
        id: string;
        order_id: string;
        product_id: string;
        product_name_snapshot: string;
        unit_label_snapshot: string;
        unit_price_paise: number;
        quantity: number;
        line_total_paise: number;
      }>;
      order_status_history: Table<{
        id: string;
        order_id: string;
        changed_by: string | null;
        old_status: OrderStatus | null;
        new_status: OrderStatus;
        note: string | null;
        created_at: string;
      }>;
      support_tickets: Table<{
        id: string;
        customer_id: string;
        shop_id: string | null;
        order_id: string | null;
        subject: string;
        status: "open" | "resolved";
        created_at: string;
        updated_at: string;
      }>;
      support_messages: Table<{
        id: string;
        ticket_id: string;
        sender_id: string;
        message: string;
        created_at: string;
      }>;
      merchant_plan_catalog: Table<{
        plan_key: "trial" | "basic" | "advanced";
        display_name: string;
        monthly_price_paise: number;
        trial_months: number;
        feature_summary: string;
        razorpay_plan_id: string | null;
      }>;
      merchant_subscriptions: Table<{
        id: string;
        merchant_id: string;
        plan_key: "trial" | "basic" | "advanced";
        status: "trialing" | "pending" | "active" | "past_due" | "paused" | "cancelled" | "expired";
        trial_started_at: string | null;
        trial_ends_at: string | null;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        cancel_requested_at: string | null;
        razorpay_subscription_id: string | null;
        checkout_url: string | null;
        checkout_lock_until: string | null;
        created_at: string;
        updated_at: string;
      }>;
      shop_ad_campaigns: Table<{
        id: string;
        shop_id: string;
        advertiser_id: string;
        target_type: "store" | "product";
        product_id: string | null;
        duration_days: number;
        amount_paise: number;
        status: "pending_payment" | "active" | "expired" | "cancelled";
        razorpay_payment_link_id: string | null;
        payment_url: string | null;
        payment_link_expires_at: string | null;
        payment_link_lock_until: string | null;
        starts_at: string | null;
        ends_at: string | null;
        created_at: string;
      }>;
      product_pools: Table<{
        id: string;
        shop_id: string;
        product_id: string;
        created_by: string;
        product_name_snapshot: string;
        unit_label_snapshot: string;
        regular_unit_price_paise: number;
        pool_unit_price_paise: number;
        target_quantity: number;
        joined_quantity: number;
        ends_at: string;
        status: "open" | "fulfilled" | "expired" | "cancelled";
        created_at: string;
      }>;
      pool_contributions: Table<{
        id: string;
        pool_id: string;
        customer_id: string;
        quantity: number;
        fulfillment_type: "pickup" | "delivery";
        address_id: string | null;
        payment_method: "cash" | "upi";
        status: "joined" | "withdrawn" | "ordered";
        order_id: string | null;
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      add_to_cart: {
        Args: { p_shop_id: string; p_inventory_id: string; p_quantity: number };
        Returns: string;
      };
      save_inventory_item: {
        Args: {
          p_shop_id: string;
          p_product_id: string | null;
          p_name: string | null;
          p_description: string | null;
          p_category_id: string | null;
          p_unit_label: string;
          p_selling_price_paise: number;
          p_quantity: number;
          p_low_stock_threshold?: number;
          p_is_available?: boolean;
        };
        Returns: string;
      };
      set_product_image: {
        Args: { p_product_id: string; p_image_path: string };
        Returns: undefined;
      };
      register_push_token: {
        Args: { p_token: string; p_platform: "ios" | "android" };
        Returns: undefined;
      };
      set_cart_item_quantity: {
        Args: { p_cart_item_id: string; p_quantity: number };
        Returns: undefined;
      };
      checkout_cart: {
        Args: {
          p_cart_id: string;
          p_fulfillment_type: "pickup" | "delivery";
          p_address_id?: string | null;
          p_payment_method?: "cash" | "upi";
          p_customer_note?: string | null;
        };
        Returns: string;
      };
      change_order_status: {
        Args: { p_order_id: string; p_new_status: OrderStatus; p_note?: string | null };
        Returns: undefined;
      };
      submit_upi_payment: {
        Args: { p_order_id: string; p_reference: string };
        Returns: undefined;
      };
      verify_upi_payment: {
        Args: { p_order_id: string; p_approved: boolean; p_note?: string | null };
        Returns: undefined;
      };
      mark_cash_paid: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      get_retailer_summary: {
        Args: { p_shop_id: string; p_from?: string; p_to?: string };
        Returns: {
          order_count: number;
          gross_sales_paise: number;
          pending_orders: number;
          low_stock_items: number;
        }[];
      };
      create_support_ticket: {
        Args: { p_subject: string; p_message: string; p_order_id?: string | null };
        Returns: string;
      };
      reply_to_support_ticket: {
        Args: { p_ticket_id: string; p_message: string };
        Returns: undefined;
      };
      set_support_ticket_status: {
        Args: { p_ticket_id: string; p_resolved: boolean };
        Returns: undefined;
      };
      create_retailer_shop: {
        Args: {
          p_name: string;
          p_description: string | null;
          p_phone: string | null;
          p_address_line: string | null;
          p_locality: string | null;
          p_city: string;
          p_state: string;
          p_postal_code: string | null;
          p_pickup_enabled: boolean;
          p_delivery_enabled: boolean;
          p_delivery_fee_paise: number;
          p_minimum_order_paise: number;
          p_opening_time: string | null;
          p_closing_time: string | null;
          p_support_phone: string | null;
          p_upi_id: string | null;
        };
        Returns: Database["public"]["Tables"]["shops"]["Row"];
      };
      create_shop_ad_campaign: {
        Args: {
          p_shop_id: string;
          p_target_type: "store" | "product";
          p_product_id: string | null;
          p_duration_days: number;
        };
        Returns: string;
      };
      create_product_pool: {
        Args: {
          p_shop_id: string;
          p_product_id: string;
          p_target_quantity: number;
          p_pool_unit_price_paise: number;
          p_ends_at: string;
        };
        Returns: string;
      };
      expire_product_pools: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      expire_ad_campaigns: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      join_product_pool: {
        Args: {
          p_pool_id: string;
          p_quantity: number;
          p_fulfillment_type: "pickup" | "delivery";
          p_address_id: string | null;
          p_payment_method: "cash" | "upi";
        };
        Returns: string | null;
      };
      leave_product_pool: {
        Args: { p_pool_id: string };
        Returns: undefined;
      };
      get_priority_shop_ids: {
        Args: Record<PropertyKey, never>;
        Returns: { shop_id: string }[];
      };
      add_shop_member_by_email: {
        Args: { p_shop_id: string; p_email: string; p_member_role?: "manager" | "staff" };
        Returns: string;
      };
      remove_shop_member: {
        Args: { p_shop_id: string; p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "customer" | "retailer" | "admin";
      order_status: OrderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type BackendClient = SupabaseClient<Database>;
export type { Session } from "@supabase/supabase-js";

const secureChunkLength = 1800;

const secureStorage = {
  async getItem(key: string) {
    const partCount = await SecureStore.getItemAsync(`${key}.parts`);
    if (!partCount) {
      const value = await SecureStore.getItemAsync(key);
      return value === null ? null : decodeURIComponent(value);
    }
    const count = Number(partCount);
    if (!Number.isInteger(count) || count < 1 || count > 32) {
      throw new Error("Stored sign-in session is invalid. Sign in again.");
    }
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(`${key}.${index}`),
      ),
    );
    if (chunks.some((chunk) => chunk === null)) {
      throw new Error("Stored sign-in session is incomplete. Sign in again.");
    }
    return decodeURIComponent(chunks.join(""));
  },
  async setItem(key: string, value: string) {
    const oldPartCount = await SecureStore.getItemAsync(`${key}.parts`);
    if (oldPartCount) {
      const count = Number(oldPartCount);
      if (Number.isInteger(count) && count > 0 && count <= 32) {
        await Promise.all(
          Array.from({ length: count }, (_, index) =>
            SecureStore.deleteItemAsync(`${key}.${index}`),
          ),
        );
      }
    }
    await SecureStore.deleteItemAsync(`${key}.parts`);
    await SecureStore.deleteItemAsync(key);

    const encoded = encodeURIComponent(value);
    if (encoded.length <= secureChunkLength) {
      await SecureStore.setItemAsync(key, encoded);
      return;
    }

    const chunks = Array.from(
      { length: Math.ceil(encoded.length / secureChunkLength) },
      (_, index) => encoded.slice(index * secureChunkLength, (index + 1) * secureChunkLength),
    );
    if (chunks.length > 32) throw new Error("Sign-in session is too large to store securely.");
    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${index}`, chunk)),
    );
    await SecureStore.setItemAsync(`${key}.parts`, String(chunks.length));
  },
  async removeItem(key: string) {
    const partCount = await SecureStore.getItemAsync(`${key}.parts`);
    const count = Number(partCount);
    if (Number.isInteger(count) && count > 0 && count <= 32) {
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          SecureStore.deleteItemAsync(`${key}.${index}`),
        ),
      );
    }
    await SecureStore.deleteItemAsync(`${key}.parts`);
    await SecureStore.deleteItemAsync(key);
  },
};

export function isBackendConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    publishableKey &&
    !url.includes("YOUR_PROJECT") &&
    !publishableKey.includes("YOUR_SUPABASE"),
  );
}

const browserStorage = {
  async getItem(key: string) {
    return typeof globalThis.localStorage === "undefined"
      ? null
      : globalThis.localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof globalThis.localStorage === "undefined") {
      throw new Error("Browser storage is unavailable. Enable browser storage and try again.");
    }
    globalThis.localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof globalThis.localStorage === "undefined") {
      throw new Error("Browser storage is unavailable. Enable browser storage and try again.");
    }
    globalThis.localStorage.removeItem(key);
  },
};

const authStorage = Platform.OS === "web" ? browserStorage : secureStorage;

export function createBackendClient(): BackendClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in this app's local .env file.",
    );
  }
  if (!/^https:\/\/[^/]+$/.test(url)) {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL must be an HTTPS project URL.");
  }

  return createClient<Database>(url, publishableKey, {
    auth: {
      storage: authStorage,
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export type { Json };

export type CatalogItem = {
  inventory: Database["public"]["Tables"]["inventory"]["Row"];
  product: Database["public"]["Tables"]["products"]["Row"];
};

export type CartItem = Database["public"]["Tables"]["cart_items"]["Row"] & CatalogItem;

export type OrderWithItems = Database["public"]["Tables"]["orders"]["Row"] & {
  items: Database["public"]["Tables"]["order_items"]["Row"][];
};

export type OrderStatusHistory = Database["public"]["Tables"]["order_status_history"]["Row"];

export type MerchantPlan = Database["public"]["Tables"]["merchant_plan_catalog"]["Row"];
export type MerchantSubscription = Database["public"]["Tables"]["merchant_subscriptions"]["Row"];
export type ShopAdCampaign = Database["public"]["Tables"]["shop_ad_campaigns"]["Row"];
export type ProductPool = Database["public"]["Tables"]["product_pools"]["Row"];
export type ShopMemberListing = {
  shop_id: string;
  user_id: string;
  member_role: "owner" | "manager" | "staff";
  created_at: string;
  full_name: string | null;
  phone: string | null;
};

export type ShopAdListing = {
  campaign: ShopAdCampaign;
  shop: Pick<Database["public"]["Tables"]["shops"]["Row"], "id" | "name" | "city" | "state"> | null;
  product: Pick<Database["public"]["Tables"]["products"]["Row"], "id" | "name" | "unit_label" | "image_path"> | null;
};

export type ProductPoolListing = {
  pool: ProductPool;
  shop: Pick<
    Database["public"]["Tables"]["shops"]["Row"],
    "id" | "name" | "city" | "state" | "pickup_enabled" | "delivery_enabled" | "delivery_fee_paise" | "upi_id"
  > | null;
  product: Pick<
    Database["public"]["Tables"]["products"]["Row"],
    "id" | "name" | "unit_label" | "image_path" | "brand"
  > | null;
  contribution: Database["public"]["Tables"]["pool_contributions"]["Row"] | null;
};

export async function getMerchantPlans(client: BackendClient) {
  const { data, error } = await client
    .from("merchant_plan_catalog")
    .select("*")
    .order("monthly_price_paise");
  if (error) throw error;
  return data;
}

export async function getMerchantSubscription(client: BackendClient, merchantId: string) {
  const { data, error } = await client
    .from("merchant_subscriptions")
    .select("*")
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getShopAdCampaigns(client: BackendClient, shopId: string) {
  const { error: expireError } = await client.rpc("expire_ad_campaigns");
  if (expireError) throw expireError;
  const { data, error } = await client
    .from("shop_ad_campaigns")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getActiveAdCampaigns(client: BackendClient): Promise<ShopAdListing[]> {
  const { error: expireError } = await client.rpc("expire_ad_campaigns");
  if (expireError) throw expireError;
  const now = new Date().toISOString();
  const { data: campaigns, error } = await client
    .from("shop_ad_campaigns")
    .select("*")
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (campaigns.length === 0) return [];

  const shopIds = [...new Set(campaigns.map((campaign) => campaign.shop_id))];
  const productIds = [...new Set(campaigns.flatMap((campaign) => campaign.product_id ? [campaign.product_id] : []))];
  const [{ data: shops, error: shopsError }, { data: products, error: productsError }] = await Promise.all([
    client.from("shops").select("id,name,city,state").in("id", shopIds),
    productIds.length
      ? client.from("products").select("id,name,unit_label,image_path").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (shopsError) throw shopsError;
  if (productsError) throw productsError;
  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  return campaigns.map((campaign) => ({
    campaign,
    shop: shopsById.get(campaign.shop_id) ?? null,
    product: campaign.product_id ? productsById.get(campaign.product_id) ?? null : null,
  }));
}

export async function createShopAdCampaign(
  client: BackendClient,
  input: {
    shopId: string;
    targetType: "store" | "product";
    productId: string | null;
    durationDays: number;
  },
) {
  const { data: campaignId, error } = await client.rpc("create_shop_ad_campaign", {
    p_shop_id: input.shopId,
    p_target_type: input.targetType,
    p_product_id: input.productId,
    p_duration_days: input.durationDays,
  });
  if (error) throw error;
  const { data, error: campaignError } = await client
    .from("shop_ad_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (campaignError) throw campaignError;
  return data;
}

export async function getRetailerProductPools(client: BackendClient, shopId: string) {
  const { error: expireError } = await client.rpc("expire_product_pools");
  if (expireError) throw expireError;
  const { data, error } = await client
    .from("product_pools")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createProductPool(
  client: BackendClient,
  input: {
    shopId: string;
    productId: string;
    targetQuantity: number;
    poolUnitPricePaise: number;
    endsAt: string;
  },
) {
  const { data, error } = await client.rpc("create_product_pool", {
    p_shop_id: input.shopId,
    p_product_id: input.productId,
    p_target_quantity: input.targetQuantity,
    p_pool_unit_price_paise: input.poolUnitPricePaise,
    p_ends_at: input.endsAt,
  });
  if (error) throw error;
  return data;
}

export async function getOpenProductPools(
  client: BackendClient,
  customerId: string,
): Promise<ProductPoolListing[]> {
  const { error: expireError } = await client.rpc("expire_product_pools");
  if (expireError) throw expireError;
  const { data: pools, error } = await client
    .from("product_pools")
    .select("*")
    .eq("status", "open")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at");
  if (error) throw error;
  if (pools.length === 0) return [];

  const poolIds = pools.map((pool) => pool.id);
  const shopIds = [...new Set(pools.map((pool) => pool.shop_id))];
  const productIds = [...new Set(pools.map((pool) => pool.product_id))];
  const [{ data: shops, error: shopsError }, { data: products, error: productsError }, { data: contributions, error: contributionsError }] = await Promise.all([
    client
      .from("shops")
      .select("id,name,city,state,pickup_enabled,delivery_enabled,delivery_fee_paise,upi_id")
      .in("id", shopIds),
    client
      .from("products")
      .select("id,name,unit_label,image_path,brand")
      .in("id", productIds),
    client
      .from("pool_contributions")
      .select("*")
      .eq("customer_id", customerId)
      .in("pool_id", poolIds),
  ]);
  if (shopsError) throw shopsError;
  if (productsError) throw productsError;
  if (contributionsError) throw contributionsError;
  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const contributionsByPool = new Map(contributions.map((contribution) => [contribution.pool_id, contribution]));
  return pools.map((pool) => ({
    pool,
    shop: shopsById.get(pool.shop_id) ?? null,
    product: productsById.get(pool.product_id) ?? null,
    contribution: contributionsByPool.get(pool.id) ?? null,
  }));
}

export async function joinProductPool(
  client: BackendClient,
  input: {
    poolId: string;
    quantity: number;
    fulfillmentType: "pickup" | "delivery";
    addressId: string | null;
    paymentMethod: "cash" | "upi";
  },
) {
  const { data, error } = await client.rpc("join_product_pool", {
    p_pool_id: input.poolId,
    p_quantity: input.quantity,
    p_fulfillment_type: input.fulfillmentType,
    p_address_id: input.addressId,
    p_payment_method: input.paymentMethod,
  });
  if (error) throw error;
  return data;
}

export async function leaveProductPool(client: BackendClient, poolId: string) {
  const { error } = await client.rpc("leave_product_pool", { p_pool_id: poolId });
  if (error) throw error;
}

export async function getActiveShops(client: BackendClient) {
  const [shopsResult, priorityResult] = await Promise.all([
    client
      .from("shops")
      .select("id,name,description,phone,address_line,locality,city,state,postal_code,is_active,pickup_enabled,delivery_enabled,delivery_fee_paise,minimum_order_paise,opening_time,closing_time,support_phone,upi_id")
      .eq("is_active", true)
      .order("name"),
    client.rpc("get_priority_shop_ids"),
  ]);
  if (shopsResult.error) throw shopsResult.error;
  if (priorityResult.error) throw priorityResult.error;
  const priorityIds = new Set(priorityResult.data.map(({ shop_id }) => shop_id));
  return [...shopsResult.data].sort((first, second) =>
    Number(priorityIds.has(second.id)) - Number(priorityIds.has(first.id))
    || first.name.localeCompare(second.name)
  );
}

export async function getActiveCategories(client: BackendClient) {
  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function getCustomerAddresses(client: BackendClient, customerId: string) {
  const { data, error } = await client
    .from("addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveCustomerAddress(
  client: BackendClient,
  input: Pick<
    Database["public"]["Tables"]["addresses"]["Row"],
    "customer_id" | "label" | "recipient_name" | "phone" | "address_line" |
    "locality" | "city" | "state" | "postal_code" | "is_default"
  > & { id?: string },
) {
  if (input.id) {
    const { data, error } = await client
      .from("addresses")
      .update(input)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client
    .from("addresses")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getRetailerShop(client: BackendClient, ownerId: string) {
  const { data: ownedShop, error: ownerError } = await client
    .from("shops")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (ownerError) throw ownerError;
  if (ownedShop) return ownedShop;

  const { data: membership, error: membershipError } = await client
    .from("shop_members")
    .select("shop_id")
    .eq("user_id", ownerId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;
  const { data: memberShop, error: shopError } = await client
    .from("shops")
    .select("*")
    .eq("id", membership.shop_id)
    .maybeSingle();
  if (shopError) throw shopError;
  return memberShop;
}

export async function addShopMemberByEmail(
  client: BackendClient,
  shopId: string,
  email: string,
  role: "manager" | "staff" = "staff",
) {
  const { data, error } = await client.rpc("add_shop_member_by_email", {
    p_shop_id: shopId,
    p_email: email,
    p_member_role: role,
  });
  if (error) throw error;
  return data;
}

export async function removeShopMember(client: BackendClient, shopId: string, userId: string) {
  const { error } = await client.rpc("remove_shop_member", {
    p_shop_id: shopId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function getShopMembers(client: BackendClient, shopId: string): Promise<ShopMemberListing[]> {
  const { data: members, error } = await client
    .from("shop_members")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at");
  if (error) throw error;
  if (members.length === 0) return [];
  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id,full_name,phone")
    .in("id", members.map((member) => member.user_id));
  if (profilesError) throw profilesError;
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  return members.map((member) => ({
    ...member,
    full_name: profilesById.get(member.user_id)?.full_name ?? null,
    phone: profilesById.get(member.user_id)?.phone ?? null,
  }));
}

export type ShopInput = Pick<
  Database["public"]["Tables"]["shops"]["Row"],
  | "name"
  | "description"
  | "phone"
  | "address_line"
  | "locality"
  | "city"
  | "state"
  | "postal_code"
  | "pickup_enabled"
  | "delivery_enabled"
  | "delivery_fee_paise"
  | "minimum_order_paise"
  | "opening_time"
  | "closing_time"
  | "support_phone"
  | "upi_id"
>;

export async function saveRetailerShop(
  client: BackendClient,
  ownerId: string,
  shopId: string | null,
  input: ShopInput,
) {
  if (shopId) {
    const { data, error } = await client
      .from("shops")
      .update(input)
      .eq("id", shopId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Your session expired. Sign in again before creating a shop.");
  if (user.id !== ownerId) {
    throw new Error("Your signed-in account changed. Refresh the app and try again.");
  }

  const { data, error } = await client.rpc("create_retailer_shop", {
    p_name: input.name,
    p_description: input.description,
    p_phone: input.phone,
    p_address_line: input.address_line,
    p_locality: input.locality,
    p_city: input.city,
    p_state: input.state,
    p_postal_code: input.postal_code,
    p_pickup_enabled: input.pickup_enabled,
    p_delivery_enabled: input.delivery_enabled,
    p_delivery_fee_paise: input.delivery_fee_paise,
    p_minimum_order_paise: input.minimum_order_paise,
    p_opening_time: input.opening_time,
    p_closing_time: input.closing_time,
    p_support_phone: input.support_phone,
    p_upi_id: input.upi_id,
  });
  if (error) throw error;
  return data;
}

export async function getShopCatalog(
  client: BackendClient,
  shopId: string,
  includeUnavailable = false,
): Promise<CatalogItem[]> {
  let inventoryQuery = client
    .from("inventory")
    .select("*")
    .eq("shop_id", shopId);
  if (!includeUnavailable) {
    inventoryQuery = inventoryQuery.eq("is_available", true).gt("available_quantity", 0);
  }
  const { data: inventory, error: inventoryError } = await inventoryQuery;
  if (inventoryError) throw inventoryError;
  if (inventory.length === 0) return [];

  const productIds = [...new Set(inventory.map((item) => item.product_id))];
  const { data: products, error: productsError } = await client
    .from("products")
    .select("*")
    .in("id", productIds)
    .eq("is_active", true);
  if (productsError) throw productsError;
  const productsById = new Map(products.map((product) => [product.id, product]));
  return inventory.flatMap((item) => {
    const product = productsById.get(item.product_id);
    return product ? [{ inventory: item, product }] : [];
  });
}

export async function getCustomerCart(
  client: BackendClient,
  customerId: string,
  shopId: string,
): Promise<{ cartId: string | null; items: CartItem[] }> {
  const { data: cart, error: cartError } = await client
    .from("carts")
    .select("*")
    .eq("customer_id", customerId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (cartError) throw cartError;
  if (!cart) return { cartId: null, items: [] };

  const { data: rows, error: itemsError } = await client
    .from("cart_items")
    .select("*")
    .eq("cart_id", cart.id);
  if (itemsError) throw itemsError;
  if (rows.length === 0) return { cartId: cart.id, items: [] };

  const inventoryIds = [...new Set(rows.map((item) => item.inventory_id))];
  const { data: inventory, error: inventoryError } = await client
    .from("inventory")
    .select("*")
    .in("id", inventoryIds);
  if (inventoryError) throw inventoryError;
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const productIds = [...new Set(inventory.map((item) => item.product_id))];
  const { data: products, error: productsError } = productIds.length
    ? await client.from("products").select("*").in("id", productIds)
    : { data: [], error: null };
  if (productsError) throw productsError;
  const productsById = new Map(products.map((product) => [product.id, product]));

  return {
    cartId: cart.id,
    items: rows.flatMap((row) => {
      const currentInventory = inventoryById.get(row.inventory_id);
      const product = currentInventory && productsById.get(currentInventory.product_id);
      return currentInventory && product
        ? [{ ...row, inventory: currentInventory, product }]
        : [];
    }),
  };
}

export async function addItemToCart(
  client: BackendClient,
  shopId: string,
  inventoryId: string,
  quantity = 1,
) {
  const { data, error } = await client.rpc("add_to_cart", {
    p_shop_id: shopId,
    p_inventory_id: inventoryId,
    p_quantity: quantity,
  });
  if (error) throw error;
  return data;
}

export async function setCartItemQuantity(
  client: BackendClient,
  cartItemId: string,
  quantity: number,
) {
  const { error } = await client.rpc("set_cart_item_quantity", {
    p_cart_item_id: cartItemId,
    p_quantity: quantity,
  });
  if (error) throw error;
}

export async function checkoutCart(
  client: BackendClient,
  cartId: string,
  fulfillment: "pickup" | "delivery",
  paymentMethod: "cash" | "upi",
  addressId?: string,
  note?: string,
) {
  const { data, error } = await client.rpc("checkout_cart", {
    p_cart_id: cartId,
    p_fulfillment_type: fulfillment,
    p_payment_method: paymentMethod,
    p_address_id: addressId ?? null,
    p_customer_note: note ?? null,
  });
  if (error) throw error;
  return data;
}

export async function getCustomerOrders(client: BackendClient, customerId: string): Promise<OrderWithItems[]> {
  const { data: orders, error } = await client
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return getOrdersWithItems(client, orders);
}

export async function getShopOrders(client: BackendClient, shopId: string): Promise<OrderWithItems[]> {
  const { data: orders, error } = await client
    .from("orders")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return getOrdersWithItems(client, orders);
}

export async function getOrderStatusHistory(client: BackendClient, orderIds: string[]): Promise<OrderStatusHistory[]> {
  if (orderIds.length === 0) return [];
  const { data, error } = await client
    .from("order_status_history")
    .select("*")
    .in("order_id", orderIds)
    .order("created_at");
  if (error) throw error;
  return data;
}

async function getOrdersWithItems(
  client: BackendClient,
  orders: Database["public"]["Tables"]["orders"]["Row"][],
): Promise<OrderWithItems[]> {
  if (orders.length === 0) return [];
  const { data: items, error } = await client
    .from("order_items")
    .select("*")
    .in("order_id", orders.map((order) => order.id));
  if (error) throw error;
  const itemsByOrder = new Map<string, Database["public"]["Tables"]["order_items"]["Row"][]>();
  for (const item of items) {
    const group = itemsByOrder.get(item.order_id) ?? [];
    group.push(item);
    itemsByOrder.set(item.order_id, group);
  }
  return orders.map((order) => ({ ...order, items: itemsByOrder.get(order.id) ?? [] }));
}

export async function saveInventoryItem(
  client: BackendClient,
  input: Database["public"]["Functions"]["save_inventory_item"]["Args"],
) {
  const { data, error } = await client.rpc("save_inventory_item", input);
  if (error) throw error;
  return data;
}

export async function setProductImage(client: BackendClient, productId: string, imagePath: string) {
  const { error } = await client.rpc("set_product_image", {
    p_product_id: productId,
    p_image_path: imagePath,
  });
  if (error) throw error;
}

export type PushRegistrationStatus =
  | "registered"
  | "web"
  | "expo-go"
  | "missing-project-id"
  | "permission-denied";

export async function registerExpoPushToken(
  client: BackendClient,
): Promise<PushRegistrationStatus> {
  if (Platform.OS === "web") return "web";
  if (Constants.appOwnership === "expo") return "expo-go";
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return "missing-project-id";

  const Notifications = await import("expo-notifications");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Order updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return "permission-denied";

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await client.rpc("register_push_token", {
    p_token: token,
    p_platform: Platform.OS === "ios" ? "ios" : "android",
  });
  if (error) throw error;
  return "registered";
}

export async function changeOrderStatus(
  client: BackendClient,
  orderId: string,
  status: OrderStatus,
  note?: string,
) {
  const { error } = await client.rpc("change_order_status", {
    p_order_id: orderId,
    p_new_status: status,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function submitUpiPayment(client: BackendClient, orderId: string, reference: string) {
  const { error } = await client.rpc("submit_upi_payment", {
    p_order_id: orderId,
    p_reference: reference,
  });
  if (error) throw error;
}

export async function reviewPayment(
  client: BackendClient,
  orderId: string,
  approved: boolean,
  note?: string,
) {
  const { error } = await client.rpc("verify_upi_payment", {
    p_order_id: orderId,
    p_approved: approved,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function markCashOrderPaid(client: BackendClient, orderId: string) {
  const { error } = await client.rpc("mark_cash_paid", { p_order_id: orderId });
  if (error) throw error;
}

export async function getRetailerSummary(
  client: BackendClient,
  shopId: string,
  from?: string,
  to?: string,
) {
  const { data, error } = await client.rpc("get_retailer_summary", {
    p_shop_id: shopId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data[0] ?? null;
}

export async function getSupportTickets(
  client: BackendClient,
  filter: { customerId?: string; shopId?: string },
) {
  let query = client.from("support_tickets").select("*").order("updated_at", { ascending: false });
  if (filter.customerId) query = query.eq("customer_id", filter.customerId);
  if (filter.shopId) query = query.eq("shop_id", filter.shopId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getSupportMessages(client: BackendClient, ticketId: string) {
  const { data, error } = await client
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function createSupportTicket(
  client: BackendClient,
  subject: string,
  message: string,
  orderId?: string,
) {
  const { data, error } = await client.rpc("create_support_ticket", {
    p_subject: subject,
    p_message: message,
    p_order_id: orderId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function replyToSupportTicket(client: BackendClient, ticketId: string, message: string) {
  const { error } = await client.rpc("reply_to_support_ticket", {
    p_ticket_id: ticketId,
    p_message: message,
  });
  if (error) throw error;
}

export async function setSupportTicketStatus(
  client: BackendClient,
  ticketId: string,
  resolved: boolean,
) {
  const { error } = await client.rpc("set_support_ticket_status", {
    p_ticket_id: ticketId,
    p_resolved: resolved,
  });
  if (error) throw error;
}
