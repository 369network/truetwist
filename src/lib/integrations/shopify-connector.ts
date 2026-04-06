import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/social/token-encryption";

const SHOPIFY_API_VERSION = "2024-10";

interface ShopifyOAuthResult {
  authorizationUrl: string;
  state: string;
}

interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
}

interface ShopifyProductNode {
  id: number;
  title: string;
  body_html: string | null;
  product_type: string;
  tags: string;
  status: string;
  variants: Array<{ id: number; price: string; title: string }>;
  images: Array<{ id: number; src: string; alt: string | null }>;
}

interface ShopifyProductsResponse {
  products: ShopifyProductNode[];
}

/**
 * Generates the Shopify OAuth2 authorization URL.
 */
export function initiateShopifyOAuth(
  shop: string,
  state: string
): ShopifyOAuthResult {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/integrations/shopify/callback`;
  const scopes = "read_products,read_product_listings";

  const params = new URLSearchParams({
    client_id: apiKey!,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  const normalizedShop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return {
    authorizationUrl: `https://${normalizedShop}/admin/oauth/authorize?${params.toString()}`,
    state,
  };
}

/**
 * Exchanges an authorization code for a Shopify access token.
 */
export async function exchangeShopifyCode(
  shop: string,
  code: string
): Promise<ShopifyTokenResponse> {
  const normalizedShop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const response = await fetch(
    `https://${normalizedShop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify token exchange failed: ${text}`);
  }

  return response.json();
}

/**
 * Stores a new Shopify connection with encrypted access token.
 */
export async function createShopifyConnection(
  businessId: string,
  shopDomain: string,
  accessToken: string,
  scopes: string
) {
  const encryptedToken = encryptToken(accessToken);

  return prisma.shopifyConnection.upsert({
    where: {
      businessId_shopDomain: { businessId, shopDomain },
    },
    update: {
      accessToken: encryptedToken,
      scopes,
      syncStatus: "idle",
    },
    create: {
      businessId,
      shopDomain,
      accessToken: encryptedToken,
      scopes,
    },
  });
}

/**
 * Syncs products from Shopify for a given connection.
 */
export async function syncProducts(connectionId: string) {
  const connection = await prisma.shopifyConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const accessToken = decryptToken(connection.accessToken);
  const shop = connection.shopDomain;

  await prisma.shopifyConnection.update({
    where: { id: connectionId },
    data: { syncStatus: "syncing" },
  });

  try {
    let pageInfo: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const url = new URL(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products.json`
      );
      url.searchParams.set("limit", "250");
      if (pageInfo) {
        url.searchParams.set("page_info", pageInfo);
      }

      const response = await fetch(url.toString(), {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data: ShopifyProductsResponse = await response.json();

      // Upsert products
      for (const product of data.products) {
        await prisma.shopifyProduct.upsert({
          where: {
            connectionId_shopifyProductId: {
              connectionId,
              shopifyProductId: String(product.id),
            },
          },
          update: {
            title: product.title,
            description: product.body_html,
            price: product.variants?.[0]?.price ?? null,
            images: product.images.map((img) => ({
              id: img.id,
              src: img.src,
              alt: img.alt,
            })),
            variants: product.variants.map((v) => ({
              id: v.id,
              price: v.price,
              title: v.title,
            })),
            productType: product.product_type || null,
            tags: product.tags || null,
            status: product.status,
          },
          create: {
            connectionId,
            shopifyProductId: String(product.id),
            title: product.title,
            description: product.body_html,
            price: product.variants?.[0]?.price ?? null,
            images: product.images.map((img) => ({
              id: img.id,
              src: img.src,
              alt: img.alt,
            })),
            variants: product.variants.map((v) => ({
              id: v.id,
              price: v.price,
              title: v.title,
            })),
            productType: product.product_type || null,
            tags: product.tags || null,
            status: product.status,
          },
        });
      }

      // Handle pagination via Link header
      const linkHeader = response.headers.get("link");
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<[^>]*page_info=([^>&]*).*?>;\s*rel="next"/);
        pageInfo = match?.[1] ?? null;
        hasNextPage = !!pageInfo;
      } else {
        hasNextPage = false;
      }
    }

    await prisma.shopifyConnection.update({
      where: { id: connectionId },
      data: { syncStatus: "idle", lastSyncAt: new Date() },
    });
  } catch (error) {
    await prisma.shopifyConnection.update({
      where: { id: connectionId },
      data: { syncStatus: "error" },
    });
    throw error;
  }
}

/**
 * Registers Shopify webhooks for product events.
 */
export async function registerShopifyWebhooks(connectionId: string) {
  const connection = await prisma.shopifyConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const accessToken = decryptToken(connection.accessToken);
  const shop = connection.shopDomain;
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/integrations/shopify/webhooks`;

  const topics = ["products/create", "products/update", "products/delete"];

  for (const topic of topics) {
    await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: callbackUrl,
            format: "json",
          },
        }),
      }
    );
  }
}

/**
 * Returns structured product data for AI content generation context enrichment.
 */
export async function enrichGenerationContext(
  businessId: string,
  productId?: string
) {
  const connections = await prisma.shopifyConnection.findMany({
    where: { businessId },
    include: {
      products: productId
        ? { where: { id: productId } }
        : { where: { status: "active" }, take: 20 },
    },
  });

  return connections.flatMap((conn) =>
    conn.products.map((product) => ({
      source: "shopify" as const,
      shopDomain: conn.shopDomain,
      productId: product.id,
      shopifyProductId: product.shopifyProductId,
      title: product.title,
      description: product.description,
      price: product.price,
      productType: product.productType,
      tags: product.tags?.split(",").map((t) => t.trim()) ?? [],
      images: product.images as Array<{ src: string; alt: string | null }>,
      variants: product.variants as Array<{
        id: number;
        price: string;
        title: string;
      }>,
    }))
  );
}
