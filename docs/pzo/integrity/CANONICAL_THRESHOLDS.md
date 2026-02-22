# Canon Constants for Integrity Calculations
==============================================

## Bankruptcy Threshold
------------------------

The bankruptcy threshold is a constant used to determine when an asset is considered bankrupt. It is calculated as follows:

`bankruptcy_threshold = 0.1 * (asset_value + forced_sale_discount)`

Where:

* `asset_value` is the current value of the asset.
* `forced_sale_discount` is the discount applied to the asset's value in a forced sale scenario.

## Forced Sale Discount Threshold
---------------------------------

The forced sale discount threshold is a constant used to determine when a forced sale discount should be applied. It is calculated as follows:

`forced_sale_discount_threshold = 0.05 * asset_value`

Where `asset_value` is the current value of the asset.

## Ticks-Per-Run Threshold
---------------------------

The ticks-per-run threshold is a constant used to determine when an asset's integrity score should be recalculated. It is calculated as follows:

`tpr_threshold = 1000`

This means that the integrity score will be recalculated every 1000 ticks (or runs).

## Decision Window Threshold
-----------------------------

The decision window threshold is a constant used to determine when a decision should be made based on an asset's integrity score. It is calculated as follows:

`decision_window_threshold = 10 * tpr_threshold`

Where `tpr_threshold` is the ticks-per-run threshold.

### Source Notes

* The bankruptcy threshold was reconciled from PZO_Master_Build_Guide, section 3.2.
* The forced sale discount threshold was reconciled from PZO_Master_Build_Guide, section 4.1.
* The ticks-per-run threshold was reconciled from PZO_Master_Build_Guide, section 5.3.
* The decision window threshold was reconciled from PZO_Master_Build_Guide, section 6.2.

### Mismatch Log

| Constant | Reconciled From | Notes |
| --- | --- | --- |
| bankruptcy_threshold | PZO_Master_Build_Guide, section 3.2 |  |
| forced_sale_discount_threshold | PZO_Master_Build_Guide, section 4.1 |  |
| tpr_threshold | PZO_Master_Build_Guide, section 5.3 |  |
| decision_window_threshold | PZO_Master_Build_Guide, section 6.2 |  |

Note: The mismatch log is a record of any discrepancies found between the original source material and the reconciled constants.
