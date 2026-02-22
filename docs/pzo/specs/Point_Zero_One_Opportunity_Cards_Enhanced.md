# Point Zero One Opportunity Cards Enhanced

## Overview

The Point Zero One Opportunity Cards Enhanced is a digital card reference for Canon cameras. This specification outlines the structure and content of the cards.

## Card Structure

Each card in the Point Zero One Opportunity Cards Enhanced has the following structure:

*   `id`: A unique identifier for the card.
*   `name`: The name of the card.
*   `description`: A brief description of the card's purpose or function.
*   `type`: The type of card (e.g., "Memory Card", "SD Card", etc.).
*   `capacity`: The storage capacity of the card in megabytes (MB) or gigabytes (GB).
*   `speed_class`: The speed class of the card (e.g., "Class 10", "U3", etc.).
*   `video_recording_speed`: The maximum video recording speed supported by the card.
*   `still_image_capture_speed`: The maximum still image capture speed supported by the card.

## Card Types

The following are the different types of cards in the Point Zero One Opportunity Cards Enhanced:

### Memory Cards

| id | name | description | type | capacity | speed_class | video_recording_speed | still_image_capture_speed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1   | SD    | Secure Digital card for storing data. | Memory Card | 16GB     | Class 10      | 60fps                | 40fps                 |

### SD Cards

| id | name | description | type | capacity | speed_class | video_recording_speed | still_image_capture_speed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2   | SD    | Secure Digital card for storing data. | Memory Card | 32GB     | U3            | 120fps               | 80fps                |

### CF Cards

| id | name | description | type | capacity | speed_class | video_recording_speed | still_image_capture_speed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3   | CF    | CompactFlash card for storing data. | Memory Card | 64GB     | UDMA7         | 240fps              | 160fps               |

## API Endpoints

The following are the API endpoints for interacting with the Point Zero One Opportunity Cards Enhanced:

### Get All Cards

*   `GET /cards`
    *   Retrieves a list of all cards in the system.

### Get Card by ID

*   `GET /cards/{id}`
    *   Retrieves a specific card by its unique identifier.

### Create New Card

*   `POST /cards`
    *   Creates a new card with the provided details.

### Update Existing Card

*   `PUT /cards/{id}`
    *   Updates an existing card with the provided details.

### Delete Card

*   `DELETE /cards/{id}`
    *   Deletes a specific card by its unique identifier.
