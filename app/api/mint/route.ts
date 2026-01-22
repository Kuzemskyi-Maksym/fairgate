export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { verifyPermit } from "@/lib/permit";

export async function POST(req: Request) {
    const secret = process.env.PERMIT_SECRET;
    if (!secret) return NextResponse.json({ error: "PERMIT_SECRET missing" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const permit = body.permit as string | undefined;

    if (!permit) return NextResponse.json({ error: "permit is required" }, { status: 400 });

    try {
        const payload = verifyPermit(permit, secret);

        // DEMO protected action:
        return NextResponse.json({
            ok: true,
            message: "Mint permitted (server-side gate + wallet ownership verified) ✅",
            wallet: payload.wallet,
            fairScore: payload.fairScore,
            fairScaleTier: payload.fairScaleTier,
            permitNonce: payload.nonce,
            expiresAt: payload.expiresAt,
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Invalid permit" }, { status: 403 });
    }
}
