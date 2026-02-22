```markdown
# Macro Systems - Inflation-7

## Overview

The Inflation-7 macro system is designed to model economic inflation within a simulated economy. It utilizes several key parameters and formulas to calculate the inflation rate over a given period.

## Key Parameters

1. `consumer_price_index` (CPI): A measure that calculates changes in the average price level of a basket of consumer goods and services purchased by households.
2. `base_year_cpi`: The CPI value of a reference or base year, often used for comparison with current inflation rates.
3. `time_period`: Represents the time span over which inflation is calculated.
4. `initial_cpi`: The initial CPI value at the start of the time period.

## Formula for Inflation Rate Calculation

The formula used to calculate the inflation rate (`inflation_rate`) in the Inflation-7 macro system is as follows:

```
inflation_rate = ((current_cpi - base_year_cpi) / base_year_cpi) * 100

where current_cpi = initial_cpi + (time_period * inflation_rate_per_unit_time)
```

## Example Usage

Given the following parameters:

- `base_year_cpi` = 100
- `time_period` = 5 years
- `initial_cpi` = 120 (at year 0)
- `inflation_rate_per_unit_time` = 2% (annual inflation rate)

The calculation would be as follows:

```
year 1: current_cpi = initial_cpi + (time_period * inflation_rate_per_unit_time) = 120 + (5 * 0.02) = 121
year 2: current_cpi = previous_cpi + (time_period * inflation_rate_per_unit_time) = 121 + (5 * 0.02) = 121.10
...
inflation_rate = ((current_cpi - base_year_cpi) / base_year_cpi) * 100 = ((136.48 - 100) / 100) * 100 = 36.48%
```

## Advantages and Limitations

Advantages:
- Simple formula for inflation rate calculation.
- Flexible time period parameter, allowing analysis over various timescales.

Limitations:
- Assumes constant annual inflation rate (inflation_rate_per_unit_time) throughout the time period.
- Does not account for factors such as supply shocks or changes in interest rates that may impact inflation.
```
