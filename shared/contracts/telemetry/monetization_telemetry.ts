/**
 * Monetization Telemetry Contracts
 */

export interface StoreViewEvent {
  timestamp: number;
  user_id: string;
  session_id?: string;
}

export interface SkuImpressionEvent extends StoreViewEvent {
  sku_id: string;
}

export interface SkuClickEvent extends StoreViewEvent {
  sku_id: string;
}

export interface OfferShownEvent extends StoreViewEvent {
  offer_id: string;
}

export interface OfferDeclinedEvent extends OfferShownEvent {
  reason?: string;
}

export interface OfferAcceptedEvent extends OfferShownEvent {
  sku_id: string;
  price: number;
}

export interface PurchaseSucceededEvent extends StoreViewEvent {
  sku_id: string;
  price: number;
  currency: string;
  transaction_id?: string;
}

export interface PurchaseFailedEvent extends StoreViewEvent {
  error_message: string;
}

export interface RefundRequestedEvent extends StoreViewEvent {
  reason?: string;
  transaction_id?: string;
}

export interface ChargebackFlaggedEvent extends StoreViewEvent {
  reason?: string;
  transaction_id?: string;
}

export interface PayToWinKeywordFlagEvent extends StoreViewEvent {
  keyword: string;
}
