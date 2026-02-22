/**
 * Partner SKU theming module for web application
 */

declare namespace partnerSkuTheming {
  type Theme = Record<string, string>;
  type Language = 'en' | 'fr' | 'de';

  function setTheme(tenantId: string, theme: Theme): Promise<void>;
  function getTheme(tenantId: string): Promise<Theme | null>;
  function setLanguage(tenantId: string, language: Language): Promise<void>;
  function getLanguage(tenantId: string): Promise<Language | null>;
}

export default partnerSkuTheming;
