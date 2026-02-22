# Revenue Architecture

## Overview

The revenue architecture for Point Zero One Digital's games is designed to provide a seamless user experience while maximizing revenue potential. This document outlines the monetization map, pipeline stages, and upgrade CTAs.

## Monetization Map

### Daily Gauntlet Free Tier

* Users can play the game without spending any money
* Limited access to premium features and content
* Upgrade prompts for Seed Pack, Season Pass, and Founder Pack

### Seed Pack ($4.99)

* One-time purchase of in-game currency or items
* Access to exclusive content and features
* No recurring subscription fees

### Season Pass ($9.99/mo)

* Recurring monthly subscription fee
* Access to premium features and content
* Exclusive rewards and benefits

### Founder Pack ($49)

* One-time purchase of exclusive in-game items and currency
* Priority customer support
* Special founder-only perks and benefits

### Premium Card Packs ($2.99)

* In-game card packs with rare and unique cards
* Access to premium features and content
* Exclusive rewards and benefits

## GHL Pipeline Stages

1. **Checkout**: User initiates checkout process for a purchase or subscription.
2. **Payment Processing**: Payment gateway (GHL) processes the transaction.
3. **Order Creation**: Order is created in the game's database.
4. **Inventory Update**: In-game inventory is updated with purchased items and currency.

## Stripe Webhook Flow

1. **Checkout**: User initiates checkout process for a purchase or subscription.
2. **Stripe Webhook**: Stripe sends a webhook notification to the game's server.
3. **Order Creation**: Order is created in the game's database.
4. **Inventory Update**: In-game inventory is updated with purchased items and currency.

## Upgrade CTAs

* Display upgrade prompts for Seed Pack, Season Pass, and Founder Pack after user completes Daily Gauntlet free tier content.
* Offer Premium Card Packs as an in-game purchase option.
