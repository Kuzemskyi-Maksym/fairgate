import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { verifyHmacToken } from "@/lib/hmac";
import { createPermit } from "@/lib/permit";
import { fetchFairScaleScore } from "@/lib/fairscale";

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

function decisionFromFairScore(score: number) {
    // Пороги можна тимчасово знизити для demo
    if (score >= 70) return { tierLabel: "Gold" as const, canMint: true, mintLimit: 3 };
    if (score >= 20) return { tierLabel: "Silver" as const, canMint: true, mintLimit: 1 };
    return { tierLabel: "Bronze" as const, canMint: false, mintLimit: 0 };
}

export async function POST(req: Request) {
    const secret = process.env.PERMIT_SECRET;
    if (!secret) return NextResponse.json({ error: "PERMIT_SECRET missing" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const wallet = body.wallet as string | undefined;
    const challengeToken = body.challengeToken as string | undefined;
    const signatureB64 = body.signature as string | undefined; // base64 string

    const twitter = (body.twitter as string | undefined) ?? null;

    if (!wallet || !challengeToken || !signatureB64) {
        return NextResponse.json(
            { error: "wallet, challengeToken, signature are required" },
            { status: 400 }
        );
    }

    // 1) Verify challengeToken (HMAC + parse)
    let challenge: ChallengePayload;
    try {
        challenge = verifyHmacToken<ChallengePayload>(challengeToken, secret);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Bad challenge token" }, { status: 403 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (challenge.expiresAt <= now) {
        return NextResponse.json({ error: "Challenge expired" }, { status: 403 });
    }

    if (challenge.wallet !== wallet) {
        return NextResponse.json({ error: "Challenge wallet mismatch" }, { status: 403 });
    }

    // 2) Verify wallet signature
    const message = buildMessage(challenge);
    const messageBytes = new TextEncoder().encode(message);

    let sigBytes: Uint8Array;
    try {
        sigBytes = new Uint8Array(Buffer.from(signatureB64, "base64"));
    } catch {
        return NextResponse.json({ error: "Bad signature encoding" }, { status: 400 });
    }

    let pubKeyBytes: Uint8Array;
    try {
        pubKeyBytes = bs58.decode(wallet);
    } catch {
        return NextResponse.json({ error: "Bad wallet address" }, { status: 400 });
    }

    const ok = nacl.sign.detached.verify(messageBytes, sigBytes, pubKeyBytes);
    if (!ok) {
        return NextResponse.json({ error: "Invalid wallet signature" }, { status: 403 });
    }

    // 3) Fetch FairScale and decide
    try {
        const score = await fetchFairScaleScore(wallet, twitter);
        const decision = decisionFromFairScore(score.fairscore);

        if (!decision.canMint) {
            return NextResponse.json(
                {
                    ok: false,
                    reason: "Score too low",
                    fairScore: score.fairscore,
                    fairScaleTier: score.tier,
                    decision,
                    badges: score.badges,
                },
                { status: 403 }
            );
        }

        // 4) Issue permit
        const permitPayload = {
            wallet,
            fairScore: score.fairscore,
            fairScaleTier: score.tier,
            issuedAt: now,
            expiresAt: now + 10 * 60,
            nonce: challenge.nonce,
        };

        const permit = createPermit(permitPayload, secret);

        return NextResponse.json({
            ok: true,
            permit,
            payload: permitPayload,
            decision,
            badges: score.badges,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "FairScale error" }, { status: 502 });
    }
}
