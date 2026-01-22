import { NextResponse } from "next/server";

type TierDecision = {
    tierLabel: "Bronze" | "Silver" | "Gold";
    canMint: boolean;
    mintLimit: number;
};

/**
 * Наші правила для прототипу.
 * Можеш легко змінити під свій продукт.
 */
function decisionFromFairScore(score: number): TierDecision {
    if (score >= 70) return { tierLabel: "Gold", canMint: true, mintLimit: 3 };
    if (score >= 40) return { tierLabel: "Silver", canMint: true, mintLimit: 1 };
    return { tierLabel: "Bronze", canMint: false, mintLimit: 0 };
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    const wallet = searchParams.get("wallet");
    const twitter = searchParams.get("twitter"); // optional

    if (!wallet) {
        return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }

    const apiKey = process.env.FAIRSCALE_API_KEY;
    const base = process.env.FAIRSCALE_API_BASE;

    if (!apiKey || !base) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const url = new URL(`${base}/score`);
    url.searchParams.set("wallet", wallet);
    if (twitter) url.searchParams.set("twitter", twitter.replace(/^@/, ""));

    const resp = await fetch(url.toString(), {
        method: "GET",
        headers: {
            // ВАЖЛИВО: Swagger каже "fairkey" header
            fairkey: apiKey,
            Accept: "application/json",
        },
    });

    if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json(
            { error: "FairScale request failed", status: resp.status, details: text },
            { status: 502 }
        );
    }

    const data = await resp.json();

    // Swagger: fairscore (number, може бути float)
    const fairScore = data?.fairscore;

    if (typeof fairScore !== "number") {
        return NextResponse.json(
            { error: "Could not parse fairscore from response", raw: data },
            { status: 502 }
        );
    }

    const decision = decisionFromFairScore(fairScore);

    return NextResponse.json({
        wallet,
        twitter: twitter ?? null,
        fairScore,
        fairScaleTier: data?.tier ?? null,
        badges: Array.isArray(data?.badges) ? data.badges : [],
        decision,
        // raw можна лишити для дебагу на початку, потім прибрати
        raw: data,
    });
}
