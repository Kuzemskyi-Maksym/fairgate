import { NextResponse } from "next/server";
import { fetchFairScaleScore } from "@/lib/fairscale";

function decisionFromFairScore(score: number) {
    // Пороги можеш міняти для демо
    if (score >= 70) return { tierLabel: "Gold" as const, canMint: true, mintLimit: 3 };
    if (score >= 40) return { tierLabel: "Silver" as const, canMint: true, mintLimit: 1 };
    return { tierLabel: "Bronze" as const, canMint: false, mintLimit: 0 };
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const twitter = searchParams.get("twitter");

    if (!wallet) return NextResponse.json({ error: "wallet is required" }, { status: 400 });

    try {
        const score = await fetchFairScaleScore(wallet, twitter);
        const decision = decisionFromFairScore(score.fairscore);

        return NextResponse.json({
            wallet: score.wallet,
            twitter: twitter ?? null,
            fairScore: score.fairscore,
            fairScaleTier: score.tier,
            badges: score.badges,
            decision,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "FairScore failed" }, { status: 502 });
    }
}
