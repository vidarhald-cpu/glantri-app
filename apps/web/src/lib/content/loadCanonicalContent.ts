import {
  defaultCanonicalContent,
  type CanonicalContent,
  validateCanonicalContent
} from "@glantri/content";

import { ContentCacheRepository } from "../offline/repositories/contentCacheRepository";

const CONTENT_CACHE_KEY = "canonical-content";

const contentCacheRepository = new ContentCacheRepository();

export async function loadCanonicalContent(): Promise<CanonicalContent> {
  const cachedContent = await contentCacheRepository.get(CONTENT_CACHE_KEY);
  return cachedContent ? validateCanonicalContent(cachedContent.value) : defaultCanonicalContent;
}
