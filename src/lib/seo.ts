/**
 * SEO utilities: JSON-LD structured data generators and OG metadata helpers.
 */

export interface MediaItem {
  mediaUrl: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  mediaType: string;
}

export interface GalleryJsonLdInput {
  name: string;
  description?: string;
  url: string;
  images: MediaItem[];
  author?: { name: string; url?: string };
  datePublished?: string;
  dateModified?: string;
}

/**
 * Generate schema.org ImageGallery JSON-LD object.
 */
export function buildImageGalleryJsonLd(input: GalleryJsonLdInput): Record<string, unknown> {
  const imageObjects = input.images
    .filter((m) => m.mediaType === "image")
    .map((img, i) => ({
      "@type": "ImageObject",
      contentUrl: img.mediaUrl,
      ...(img.altText && { name: img.altText, description: img.altText }),
      ...(img.width && { width: { "@type": "QuantitativeValue", value: img.width } }),
      ...(img.height && { height: { "@type": "QuantitativeValue", value: img.height } }),
      position: i + 1,
    }));

  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: input.name,
    ...(input.description && { description: input.description }),
    url: input.url,
    ...(input.datePublished && { datePublished: input.datePublished }),
    ...(input.dateModified && { dateModified: input.dateModified }),
    ...(input.author && {
      author: {
        "@type": "Person",
        name: input.author.name,
        ...(input.author.url && { url: input.author.url }),
      },
    }),
    image: imageObjects,
    numberOfItems: imageObjects.length,
  };
}

export interface PostJsonLdInput {
  headline: string;
  description?: string;
  url: string;
  images: MediaItem[];
  author?: { name: string; url?: string };
  datePublished?: string;
  dateModified?: string;
  publisher?: { name: string; logoUrl?: string };
}

/**
 * Generate schema.org SocialMediaPosting JSON-LD object.
 */
export function buildSocialMediaPostingJsonLd(input: PostJsonLdInput): Record<string, unknown> {
  const imageUrls = input.images
    .filter((m) => m.mediaType === "image")
    .map((img) => img.mediaUrl);

  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: input.headline,
    ...(input.description && { articleBody: input.description }),
    url: input.url,
    ...(input.datePublished && { datePublished: input.datePublished }),
    ...(input.dateModified && { dateModified: input.dateModified }),
    ...(imageUrls.length > 0 && { image: imageUrls }),
    ...(input.author && {
      author: {
        "@type": "Person",
        name: input.author.name,
        ...(input.author.url && { url: input.author.url }),
      },
    }),
    ...(input.publisher && {
      publisher: {
        "@type": "Organization",
        name: input.publisher.name,
        ...(input.publisher.logoUrl && {
          logo: { "@type": "ImageObject", url: input.publisher.logoUrl },
        }),
      },
    }),
  };
}

/**
 * Generate schema.org WebSite JSON-LD for the root layout.
 */
export function buildWebSiteJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TrueTwist",
    url: siteUrl,
    description: "AI-Powered Social Media Content Management Platform",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/dashboard/posts?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Build OG metadata for a post/gallery page.
 */
export function buildPostOgMetadata(input: {
  title: string;
  description: string;
  url: string;
  images: MediaItem[];
  siteName?: string;
}) {
  const ogImages = input.images
    .filter((m) => m.mediaType === "image")
    .slice(0, 4)
    .map((img) => ({
      url: img.mediaUrl,
      ...(img.width && { width: img.width }),
      ...(img.height && { height: img.height }),
      ...(img.altText && { alt: img.altText }),
    }));

  return {
    title: input.title,
    description: input.description,
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.url,
      siteName: input.siteName ?? "TrueTwist",
      type: "article" as const,
      images: ogImages,
    },
    twitter: {
      card: ogImages.length > 0 ? ("summary_large_image" as const) : ("summary" as const),
      title: input.title,
      description: input.description,
      ...(ogImages[0] && { images: [ogImages[0].url] }),
    },
  };
}
