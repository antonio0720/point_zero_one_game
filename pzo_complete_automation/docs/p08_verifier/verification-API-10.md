# Verifier + Proof Cards - Verification-API-10

## Overview

This document outlines the Verifier API version 10, which is designed to work with proof cards for verification purposes.

## API Endpoints

### Verify Proof

`POST /api/v10/verify_proof`

Verifies a proof card provided in the request body. The response will indicate whether the proof is valid or not.

**Request Body**

```json
{
"proof_card": {
"proof_id": "unique_proof_identifier",
"proof_data": "base64 encoded proof data"
}
}
```

**Response**

```json
{
"status": "success" | "failure",
"message": "optional message explaining the result"
}
```

### Get Proof Details

`GET /api/v10/proof/{proof_id}`

Retrieves details about a specific proof card.

**Response**

```json
{
"status": "success",
"data": {
"proof_id": "unique_proof_identifier",
"proof_data": "base64 encoded proof data"
}
}
```

## Error Handling

The API returns HTTP status codes to indicate the success or failure of requests. Common errors include:

- `400 Bad Request`: The request body is missing required fields or contains invalid data.
- `404 Not Found`: The requested proof does not exist.
- `500 Internal Server Error`: An unexpected error occurred on the server.

## Security Considerations

- Always store and transmit proof cards securely, as they contain sensitive information.
- Rate limiting should be implemented to prevent abuse of the API.
- Implement proper authentication and authorization mechanisms to ensure only authorized users can access the API.
