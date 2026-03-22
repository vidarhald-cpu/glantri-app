import { defaultCanonicalContent } from "./seeds/defaultContent";
import { type CanonicalContent, type CanonicalContentLoader } from "./types";
import { validateCanonicalContent } from "./validators";

export async function loadCanonicalContent(
  loader?: CanonicalContentLoader
): Promise<CanonicalContent> {
  const content = loader ? await loader.load() : defaultCanonicalContent;
  return validateCanonicalContent(content);
}
