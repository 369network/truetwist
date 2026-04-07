import type { IVideoProvider, VideoProviderName, VideoProviderWebhookPayload } from './types';
import { VideoProviderError } from './types';
import { SynthesiaProvider } from './synthesia';
import { HeyGenProvider } from './heygen';

// ============================================
// Video Provider Registry
// ============================================

const providers: Map<VideoProviderName, IVideoProvider> = new Map();

// Lazy-initialize providers on first access
function ensureProviders(): void {
  if (providers.size > 0) return;
  providers.set('synthesia', new SynthesiaProvider());
  providers.set('heygen', new HeyGenProvider());
}

/**
 * Get a specific video provider by name.
 * Throws if the provider is not registered.
 */
export function getProvider(name: VideoProviderName): IVideoProvider {
  ensureProviders();
  const provider = providers.get(name);
  if (!provider) {
    throw new VideoProviderError(
      `Unknown video provider: ${name}`,
      name
    );
  }
  return provider;
}

/**
 * Get the best available provider. Prefers Synthesia (primary), falls back to HeyGen.
 * Returns null if no provider is configured.
 */
export function getDefaultProvider(): IVideoProvider | null {
  ensureProviders();

  // Primary: Synthesia
  const synthesia = providers.get('synthesia');
  if (synthesia?.isConfigured()) return synthesia;

  // Secondary: HeyGen
  const heygen = providers.get('heygen');
  if (heygen?.isConfigured()) return heygen;

  return null;
}

/**
 * List all registered providers with their configuration status.
 */
export function listProviders(): Array<{
  name: VideoProviderName;
  configured: boolean;
}> {
  ensureProviders();
  return Array.from(providers.entries()).map(([name, provider]) => ({
    name,
    configured: provider.isConfigured(),
  }));
}

/**
 * Parse a webhook payload from a given provider.
 */
export function parseWebhook(
  providerName: string,
  body: Record<string, unknown>
): VideoProviderWebhookPayload {
  switch (providerName) {
    case 'synthesia':
      return SynthesiaProvider.parseWebhook(body);
    case 'heygen':
      return HeyGenProvider.parseWebhook(body);
    default:
      throw new VideoProviderError(
        `Unsupported webhook provider: ${providerName}`,
        providerName as VideoProviderName
      );
  }
}

// Re-export types and utilities
export type { IVideoProvider, VideoProviderName, VideoProviderWebhookPayload } from './types';
export type { VideoProviderGenerateRequest, VideoProviderJobResult, VideoProviderTemplate } from './types';
export { VideoProviderError } from './types';
export { mapTemplate, getSupportedTemplates } from './template-mapping';
