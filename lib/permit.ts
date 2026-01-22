import { createHmacToken, verifyHmacToken } from "./hmac";

export type PermitPayload = {
    wallet: string;
    fairScore: number;
    fairScaleTier: string | null;
    issuedAt: number;  // unix seconds
    expiresAt: number; // unix seconds
    nonce: string;
};

export function createPermit(payload: PermitPayload, secret: string) {
    return createHmacToken(payload, secret);
}

export function verifyPermit(token: string, secret: string): PermitPayload {
    const payload = verifyHmacToken<PermitPayload>(token, secret);

    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt <= now) throw new Error("Permit expired");

    return payload;
}
