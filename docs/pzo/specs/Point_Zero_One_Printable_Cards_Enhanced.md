# Point Zero One Printable Cards Enhanced

## Overview

This specification outlines the design and layout for printable cards used in Point Zero One games. The cards are designed to be printed on a standard A6 sheet of paper, with space for Canon-compatible printer stickers.

## Card Layout

The card layout is divided into several sections:

### Header Section

* **Card Name**: The name of the card.
* **Card Type**: The type of card (e.g. unit, event, etc.).

### Body Section

* **Card Text**: A brief description of the card's effects or abilities.

### Footer Section

* **Cost**: The cost to play the card.
* **Power/Toughness**: The power and toughness values for units.

## Card Types

The following card types are supported:

### Unit Cards

* **Name**: The name of the unit.
* **Power**: The power value of the unit.
* **Toughness**: The toughness value of the unit.
* **Econ Blocks**: A list of econ blocks associated with the unit.

### Event Cards

* **Name**: The name of the event.
* **Effect**: A brief description of the event's effects or abilities.

## Econ Blocks

Econ blocks are used to represent the economic costs and benefits associated with a card. They are represented as a series of lines, each containing a key-value pair:

* **Key**: The type of econ block (e.g. "Gold", "Food", etc.).
* **Value**: The amount of the resource affected by the econ block.

## Example Card

Here is an example of what a completed card might look like:
```markdown
### Unit Card: Golem

#### Header Section

* **Card Name**: Golem
* **Card Type**: Unit

#### Body Section

* **Card Text**: A powerful golem that can be used to defend against enemy units.

#### Footer Section

* **Cost**: 2 Gold, 1 Food
* **Power/Toughness**: 4/3

#### Econ Blocks

* **Gold**: +2
* **Food**: -1
```

## Printing the Cards

To print the cards, follow these steps:

1. Open a text editor and create a new file.
2. Copy the contents of this specification into the file.
3. Replace any placeholder values (e.g. "Golem") with the actual card name and details.
4. Save the file as a Markdown document.
5. Print the document on a standard A6 sheet of paper using a Canon-compatible printer.

Note: The econ blocks will be printed as stickers, which can be applied to the corresponding resource icons on the card.
