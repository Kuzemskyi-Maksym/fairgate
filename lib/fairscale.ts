export type FairScaleScore = {
    wallet: string;
    fairscore: number;
    tier: string | null;
    badges: Array<{ id: string; label: string; description?: string; tier?: string }>;
};

export async function fetchFairScaleScore(wallet: string, twitter?: string | null) {
    const apiKey = process.env.FAIRSCALE_API_KEY;
    const base = process.env.FAIRSCALE_API_BASE;

    if (!apiKey || !base) throw new Error("FairScale env is missing");

    const url = new URL(`${base}/score`);
    url.searchParams.set("wallet", wallet);
    if (twitter) url.searchParams.set("twitter", twitter.replace(/^@/, ""));

    const resp = await fetch(url.toString(), {
        headers: { fairkey: apiKey, Accept: "application/json" },
        cache: "no-store",
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`FairScale failed: ${resp.status} ${text}`);
    }

    const data = await resp.json();

    return {
        wallet: data.wallet,
        fairscore: data.fairscore,
        tier: data.tier ?? null,
        badges: Array.isArray(data.badges) ? data.badges : [],
    } as FairScaleScore;
}
