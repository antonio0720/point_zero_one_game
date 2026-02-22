# Point Zero One Game Cards

## Card Types

### Base Cards

| Type | Name | Description |
| --- | --- | --- |
| `CANON` | Canon | A base card that represents a canon in the game. |

### Card Properties

* `type`: The type of card (e.g., `CANON`, `EVENT`, etc.)
* `name`: The name of the card
* `description`: A brief description of the card's effect or purpose

## Canon Base Cards

| Name | Description |
| --- | --- |
| Canon | Represents a canon in the game. |

### Example Use Case

```markdown
A canon base card can be used to represent a player's starting equipment.
```

### API Documentation

#### Get Card Details

* `GET /cards/{cardId}`
	+ Returns the details of a specific card, including its type and name.

#### List All Cards

* `GET /cards`
	+ Returns a list of all cards in the game, including their types and names.
