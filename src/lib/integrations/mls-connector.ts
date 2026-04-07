import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/social/token-encryption";

interface MlsCredentials {
  clientId: string;
  clientSecret: string;
  tokenUrl?: string;
}

interface ResoPropertyResponse {
  value: ResoProperty[];
  "@odata.nextLink"?: string;
}

interface ResoProperty {
  ListingKey: string;
  UnparsedAddress: string;
  City: string;
  StateOrProvince: string;
  PostalCode: string;
  ListPrice: number;
  BedroomsTotal?: number;
  BathroomsTotalDecimal?: number;
  LivingArea?: number;
  PublicRemarks?: string;
  Media?: Array<{ MediaURL: string }>;
  StandardStatus: string;
  ListAgentFullName?: string;
  ListAgentDirectPhone?: string;
}

/**
 * Fetches an OAuth2 bearer token from the RESO/MLS feed.
 */
async function getMlsBearerToken(
  feedUrl: string,
  credentials: MlsCredentials
): Promise<string> {
  const tokenUrl =
    credentials.tokenUrl || `${new URL(feedUrl).origin}/oauth2/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`MLS token request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Configures and stores a new MLS feed connection.
 */
export async function configureMlsFeed(
  businessId: string,
  feedUrl: string,
  credentials: MlsCredentials,
  syncSchedule?: string
) {
  const encryptedCredentials = encryptToken(JSON.stringify(credentials));

  // Validate connection by attempting token fetch
  await getMlsBearerToken(feedUrl, credentials);

  return prisma.mlsConnection.upsert({
    where: {
      businessId_feedUrl: { businessId, feedUrl },
    },
    update: {
      credentials: encryptedCredentials,
      syncSchedule: syncSchedule || "0 */6 * * *",
      syncStatus: "idle",
    },
    create: {
      businessId,
      feedUrl,
      credentials: encryptedCredentials,
      syncSchedule: syncSchedule || "0 */6 * * *",
    },
  });
}

/**
 * Syncs listings from the MLS/RESO feed for a given connection.
 */
export async function syncListings(connectionId: string) {
  const connection = await prisma.mlsConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const credentials: MlsCredentials = JSON.parse(
    decryptToken(connection.credentials)
  );
  const bearerToken = await getMlsBearerToken(connection.feedUrl, credentials);

  await prisma.mlsConnection.update({
    where: { id: connectionId },
    data: { syncStatus: "syncing" },
  });

  try {
    let nextUrl: string | null = `${connection.feedUrl}/Property?$top=200`;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`RESO API error: ${response.status}`);
      }

      const data: ResoPropertyResponse = await response.json();

      for (const property of data.value) {
        await prisma.mlsListing.upsert({
          where: {
            connectionId_mlsListingId: {
              connectionId,
              mlsListingId: property.ListingKey,
            },
          },
          update: {
            address: property.UnparsedAddress,
            city: property.City,
            state: property.StateOrProvince,
            zipCode: property.PostalCode,
            price: property.ListPrice,
            bedrooms: property.BedroomsTotal ?? null,
            bathrooms: property.BathroomsTotalDecimal ?? null,
            squareFeet: property.LivingArea ?? null,
            description: property.PublicRemarks ?? null,
            photos: (property.Media ?? []).map((m) => m.MediaURL),
            listingStatus: mapResoStatus(property.StandardStatus),
            agentName: property.ListAgentFullName ?? null,
            agentPhone: property.ListAgentDirectPhone ?? null,
          },
          create: {
            connectionId,
            mlsListingId: property.ListingKey,
            address: property.UnparsedAddress,
            city: property.City,
            state: property.StateOrProvince,
            zipCode: property.PostalCode,
            price: property.ListPrice,
            bedrooms: property.BedroomsTotal ?? null,
            bathrooms: property.BathroomsTotalDecimal ?? null,
            squareFeet: property.LivingArea ?? null,
            description: property.PublicRemarks ?? null,
            photos: (property.Media ?? []).map((m) => m.MediaURL),
            listingStatus: mapResoStatus(property.StandardStatus),
            agentName: property.ListAgentFullName ?? null,
            agentPhone: property.ListAgentDirectPhone ?? null,
          },
        });
      }

      nextUrl = data["@odata.nextLink"] ?? null;
    }

    await prisma.mlsConnection.update({
      where: { id: connectionId },
      data: { syncStatus: "idle", lastSyncAt: new Date() },
    });
  } catch (error) {
    await prisma.mlsConnection.update({
      where: { id: connectionId },
      data: { syncStatus: "error" },
    });
    throw error;
  }
}

function mapResoStatus(status: string): string {
  const map: Record<string, string> = {
    Active: "active",
    ActiveUnderContract: "pending",
    Pending: "pending",
    Closed: "sold",
    Expired: "expired",
    Withdrawn: "expired",
    Canceled: "expired",
  };
  return map[status] || "active";
}

/**
 * Returns structured listing data for AI content generation context enrichment.
 */
export async function enrichGenerationContext(
  businessId: string,
  listingId?: string
) {
  const connections = await prisma.mlsConnection.findMany({
    where: { businessId },
    include: {
      listings: listingId
        ? { where: { id: listingId } }
        : { where: { listingStatus: "active" }, take: 20 },
    },
  });

  return connections.flatMap((conn) =>
    conn.listings.map((listing) => ({
      source: "mls" as const,
      feedUrl: conn.feedUrl,
      listingId: listing.id,
      mlsListingId: listing.mlsListingId,
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zipCode: listing.zipCode,
      price: listing.price,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      squareFeet: listing.squareFeet,
      description: listing.description,
      photos: listing.photos as string[],
      listingStatus: listing.listingStatus,
      agentName: listing.agentName,
      agentPhone: listing.agentPhone,
    }))
  );
}
