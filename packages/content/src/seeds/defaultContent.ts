import { validateCanonicalContent } from "../validators";

import { generatedRepoLocalGlantriSeed } from "./generatedRepoLocalGlantriSeed";

export const defaultCanonicalContent = validateCanonicalContent(generatedRepoLocalGlantriSeed);
