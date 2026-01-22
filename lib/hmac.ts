import crypto from "crypto";

export function base64url(input: Buffer | string) {
    const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return b
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

export function base64urlDecode(s: string) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad) s += "=".repeat(4 - pad);
    return Buffer.from(s, "base64");
}

function sign(data: string, secret: string) {
    return base64url(crypto.createHmac("sha256", secret).update(data).digest());
}

export function createHmacToken<T extends object>(payload: T, secret: string) {
    const body = base64url(JSON.stringify(payload));
    const sig = sign(body, secret);
    return `${body}.${sig}`;
}

export function verifyHmacToken<T>(token: string, secret: string): T {
    const [body, sig] = token.split(".");
    if (!body || !sig) throw new Error("Bad token format");

    const expected = sign(body, secret);

    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error("Invalid token signature");
    }

    const json = base64urlDecode(body).toString("utf8");
    return JSON.parse(json) as T;
}

export function randomNonce() {
    return crypto.randomBytes(16).toString("hex");
}
