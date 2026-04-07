import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildImageGalleryJsonLd, buildSocialMediaPostingJsonLd, buildPostOgMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://truetwist.com";

interface Props {
  params: Promise<{ id: string }>;
}

async function getPost(id: string) {
  return prisma.post.findUnique({
    where: { id, status: "posted" },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      user: { select: { name: true } },
      business: { select: { name: true } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: "Post Not Found" };

  const title = post.contentText?.slice(0, 70) ?? "Post on TrueTwist";
  const description = post.contentText?.slice(0, 200) ?? "View this post on TrueTwist";

  return buildPostOgMetadata({
    title,
    description,
    url: `${SITE_URL}/posts/${post.id}`,
    images: post.media.map((m) => ({
      mediaUrl: m.mediaUrl,
      altText: m.altText,
      width: m.width,
      height: m.height,
      mediaType: m.mediaType,
    })),
  });
}

export default async function SharedPostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  const images = post.media.map((m) => ({
    mediaUrl: m.mediaUrl,
    altText: m.altText,
    width: m.width,
    height: m.height,
    mediaType: m.mediaType,
  }));

  const hasImages = images.some((m) => m.mediaType === "image");
  const postUrl = `${SITE_URL}/posts/${post.id}`;

  const jsonLd = hasImages
    ? buildImageGalleryJsonLd({
        name: post.contentText?.slice(0, 70) ?? "Image Gallery",
        description: post.contentText ?? undefined,
        url: postUrl,
        images,
        author: post.user ? { name: post.user.name } : undefined,
        datePublished: post.createdAt.toISOString(),
        dateModified: post.updatedAt.toISOString(),
      })
    : buildSocialMediaPostingJsonLd({
        headline: post.contentText?.slice(0, 110) ?? "Post on TrueTwist",
        description: post.contentText ?? undefined,
        url: postUrl,
        images,
        author: post.user ? { name: post.user.name } : undefined,
        datePublished: post.createdAt.toISOString(),
        dateModified: post.updatedAt.toISOString(),
        publisher: { name: "TrueTwist" },
      });

  return (
    <>
      <JsonLd data={jsonLd} />
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="mx-auto max-w-2xl px-4 py-12">
          {/* Header */}
          <div className="mb-6">
            <p className="text-sm text-gray-400">
              {post.user?.name}{post.business ? ` · ${post.business.name}` : ""}
            </p>
            <time className="text-xs text-gray-500" dateTime={post.createdAt.toISOString()}>
              {post.createdAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>

          {/* Content */}
          {post.contentText && (
            <p className="mb-8 whitespace-pre-wrap text-lg leading-relaxed text-gray-200">
              {post.contentText}
            </p>
          )}

          {/* Media Gallery */}
          {post.media.length > 0 && (
            <div
              className={
                post.media.length === 1
                  ? "grid grid-cols-1 gap-3"
                  : "grid grid-cols-2 gap-3"
              }
            >
              {post.media.map((m) =>
                m.mediaType === "image" ? (
                  <img
                    key={m.id}
                    src={m.mediaUrl}
                    alt={m.altText ?? ""}
                    width={m.width ?? undefined}
                    height={m.height ?? undefined}
                    className="rounded-xl object-cover w-full"
                    loading="lazy"
                  />
                ) : m.mediaType === "video" ? (
                  <video
                    key={m.id}
                    src={m.mediaUrl}
                    controls
                    className="rounded-xl w-full"
                    poster={m.thumbnailUrl ?? undefined}
                  />
                ) : null
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 border-t border-gray-800 pt-6 text-center">
            <p className="text-sm text-gray-500">
              Shared via{" "}
              <a href={SITE_URL} className="text-indigo-400 hover:underline">
                TrueTwist
              </a>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
