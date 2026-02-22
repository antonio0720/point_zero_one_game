export interface JwsHeader {
alg: string;
typ: string;
}

export interface JwsPayload {
// Your custom payload structure goes here
}

export interface JwsSignature {
sig: string;
}
