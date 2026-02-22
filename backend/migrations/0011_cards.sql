-- Point Zero One Digital - Card Definitions and Versions, Deck Definitions and Compositions, Ruleset Versions
-- Strict types, no 'any', export all public symbols, include JSDoc
-- CREATE IF NOT EXISTS for idempotency

CREATE TYPE card_type AS ENUM ('ACTION', 'TREASURE', 'CURSE');

CREATE TABLE card_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type card_type NOT NULL,
    cost INT NOT NULL,
    description TEXT,
    UNIQUE (name)
);

CREATE INDEX idx_card_definitions_type ON card_definitions (type);

CREATE TABLE card_versions (
    id SERIAL PRIMARY KEY,
    card_id INTEGER REFERENCES card_definitions(id),
    version INT NOT NULL,
    content_hash VARCHAR(32) NOT NULL UNIQUE,
    UNIQUE (card_id, version)
);

CREATE TABLE deck_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ruleset_version_id INTEGER REFERENCES ruleset_versions(id),
    UNIQUE (name, ruleset_version_id)
);

CREATE TABLE deck_compositions (
    id SERIAL PRIMARY KEY,
    deck_definition_id INTEGER REFERENCES deck_definitions(id),
    card_version_id INTEGER REFERENCES card_versions(id),
    quantity INT NOT NULL,
    UNIQUE (deck_definition_id, card_version_id)
);

CREATE TABLE ruleset_versions (
    id SERIAL PRIMARY KEY,
    content_hash VARCHAR(32) NOT NULL UNIQUE
);
