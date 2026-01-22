import { NextResponse } from "next/server";
import { createHmacToken, randomNonce } from "@/lib/hmac";

type ChallengePayload = {
    wallet: string;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
};

function buildMessage(payload: ChallengePayload) {
    return [
        "FairGate Permit Request",
        `Wallet: ${payload.wallet}`,
        `Nonce: ${payload.nonce}`,
        `ExpiresAt: ${payload.expiresAt}`,
    ].join("\n");
}

export async function POST(req: Request) {
    const secret = process.env.PERMIT_SECRET;
    if (!secret) return NextResponse.json({ error: "PERMIT_SECRET missing" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const wallet = body.wallet as string | undefined;

    if (!wallet) return NextResponse.json({ error: "wallet is required" }, { status: 400 });

    const now = Math.floor(Date.now() / 1000);

    const payload: ChallengePayload = {
        wallet,
        nonce: randomNonce(),
        issuedAt: now,
        expiresAt: now + 5 * 60,
    };

    const challengeToken = createHmacToken(payload, secret);
    const message = buildMessage(payload);

    return NextResponse.json({ ok: true, challengeToken, message, expiresAt: payload.expiresAt });
}
