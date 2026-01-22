export {
  AppConfigProvider,
  useAppConfig,
  useSocialLinks,
  useAppStoreLinks,
} from "./appConfig";

export { ThemeProvider, useTheme } from "./theme";

export {
  fetchLegalDocument,
  clearLegalDocumentsCache,
} from "./legalDocuments";

export type { AppConfig } from "./appConfig";
export type { LegalDocument } from "./legalDocuments";
