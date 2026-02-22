# Point Zero One Digital SKU Taxonomy

This document outlines the taxonomy of SKUs (Stock Keeping Units) for Point Zero One Digital's digital products. The taxonomy is designed to provide a clear, consistent structure for our offerings while ensuring compliance with our governance principles.

## Non-negotiables

1. **SKU Classes**: Each SKU belongs to one of the predefined classes that represent the type and functionality of the digital product. The classes are immutable and cannot be changed once assigned.

2. **Immutable Tags**: Certain tags associated with an SKU are also immutable, denoting specific attributes such as platform compatibility or regional availability.

3. **Allowed vs Forbidden**: Some combinations of SKU classes and tags are allowed, while others are forbidden to prevent conflicts and ensure a seamless user experience.

## Implementation Spec

### SKU Classes

- `BASE`: Basic digital product without any additional features or services.
- `PREMIUM`: Enhanced version of the base product with added features or services.
- `ADDON`: Additional feature or service that can be purchased separately and is compatible with specific base products.
- `SUBSCRIPTION`: Recurring payment for access to a digital product or service over a specified period.

### Immutable Tags

- `PLATFORM_X`: Indicates the platform (e.g., iOS, Android) that the SKU is compatible with.
- `REGION_Y`: Denotes the geographical region where the SKU is available for purchase.
- `LANGUAGE_Z`: Specifies the language in which the SKU's user interface is presented.

### Allowed vs Forbidden Combinations

- A base product (`BASE`) cannot be combined with any tags.
- An addon (`ADDON`) can only be combined with a compatible base product (`BASE` or `PREMIUM`).
- A subscription (`SUBSCRIPTION`) can only be combined with a compatible base product (`BASE` or `PREMIUM`).

## Edge Cases

1. If a base product (`BASE`) is upgraded to a premium version (`PREMIUM`), any associated addons (`ADDON`) will remain compatible, as long as they are also compatible with the new premium product.
2. If a subscription (`SUBSCRIPTION`) is cancelled, any associated addons (`ADDON`) will no longer be accessible unless renewed separately.
