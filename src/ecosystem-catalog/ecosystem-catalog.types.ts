export type CatalogCategory =
  | 'infrastructure'
  | 'clients-apps'
  | 'services'
  | 'portals-platforms'
  | 'developer-tools';

export type CatalogStatus = 'active' | 'beta' | 'deprecated';
export type PricingModel = 'free' | 'freemium' | 'paid';

export interface CatalogMetrics {
  uptime: number;
  monthlyUsers: number;
  activityScore: number;
  trend30d: number[];
}

export interface CatalogReview {
  source: string;
  rating: number;
  comment?: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  url: string;
  description: string;
  category: CatalogCategory;
  subcategory: string;
  features: string[];
  supportedNips: string[];
  pricing: PricingModel;
  status: CatalogStatus;
  metrics: CatalogMetrics;
  trustScore: number;
  reviews: CatalogReview[];
  tags: string[];
  operator: string;
  lastUpdated: string;
  discoveryDate: string;
  alternatives: string[];
  useCases: string[];
}

export interface CatalogDatabase {
  version: number;
  generatedAt: string;
  sources: string[];
  entries: CatalogEntry[];
}

export interface CatalogQuery {
  category?: CatalogCategory;
  subcategory?: string;
  pricing?: PricingModel;
  status?: CatalogStatus;
  nip?: string;
  q?: string;
  tags?: string[];
  minTrust?: number;
}
