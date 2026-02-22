# DTC Store Spec (Shopify or Custom)

## Overview

This document outlines the specifications for the DTC (Direct-to-Consumer) store integration in Point Zero One Digital's 12-minute financial roguelike game. The store will support product pages, bundle configurations, digital companion upsell, email capture at checkout, and order fulfillment with 3PL (Third-Party Logistics) integration.

## Non-Negotiables

1. **Product Pages**: Base, Deluxe, Expansions, Host Kit, and Community Kit products must be supported. Each product page should provide detailed information about the product, including images, descriptions, and pricing.

2. **Bundle Configurations**: The store should support creating and managing bundles of multiple products. This includes offering discounts for purchasing bundled items together.

3. **Digital Companion Upsell**: The store should offer a digital companion as an upsell during the checkout process. This could include additional game content, guides, or other digital assets.

4. **Email Capture at Checkout**: Customers should be given the option to provide their email address during the checkout process for marketing and customer support purposes.

5. **Order Fulfillment + 3PL Integration**: The store should handle order fulfillment, including generating invoices, packing slips, and shipping labels. It should also integrate with a 3PL service to manage physical product storage and shipping.

## Implementation Spec

### Shopify Store

- Use the Shopify API to create and manage products, bundles, orders, and customer data.
- Implement custom themes as needed to match the game's branding.
- Set up email capture at checkout using Shopify's built-in tools or third-party apps.
- Integrate with a 3PL service such as ShipStation or Fulfillment by Amazon (FBA).

### Custom Store

- Develop a custom e-commerce platform using TypeScript, adhering to strict mode and avoiding the use of 'any'. All effects should be deterministic.
- Implement APIs for product management, order fulfillment, and customer data.
- Integrate with a 3PL service as needed.

## Edge Cases

- **Currency Support**: The store should support multiple currencies to accommodate international customers.
- **Taxes**: The store should handle tax calculations based on the customer's location.
- **Payment Methods**: The store should support various payment methods, including credit cards, PayPal, and cryptocurrency.
