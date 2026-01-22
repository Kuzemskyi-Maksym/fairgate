"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButtonClient from "./components/WalletButtonClient";

type Badge = {
    id: string;
    label: string;
    description?: string;
    tier?: string;
};

type FairScoreApiResponse = {
    wallet: string;
    twitter: string | null;
    fairScore: number;
    fairScaleTier: string | null;
    badges: Badge[];
    decision: {
        tierLabel: "Bronze" | "Silver" | "Gold";
        canMint: boolean;
        mintLimit: number;
    };
};

export default function HomePage() {
    const { publicKey, connected } = useWallet();

    const walletAddress = publicKey?.toBase58() ?? null;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [data, setData] = useState<FairScoreApiResponse | null>(null);

    const [permit, setPermit] = useState<string | null>(null);
    const [mintMsg, setMintMsg] = useState<string | null>(null);

    async function fetchFairScore(addr: string) {
        setLoading(true);
        setError(null);
        setMintMsg(null);
        setPermit(null);

        try {
            const res = await fetch(`/api/fairscore?wallet=${encodeURIComponent(addr)}`);
            const json = await res.json();

            if (!res.ok) {
                setError(json?.error ?? "FairScore request failed");
                setData(null);
                return;
            }

            setData(json);
        } catch {
            setError("Network/Server error while fetching FairScore");
            setData(null);
        } finally {
            setLoading(false);
        }
    }

    async function requestPermit(addr: string) {
        setError(null);
        setMintMsg(null);
        setPermit(null);

        try {
            const res = await fetch("/api/permit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: addr }),
            });

            const json = await res.json();

            if (!res.ok) {
                // /api/permit повертає 403 з reason/decision якщо score низький
                setError(json?.reason ?? json?.error ?? "Permit denied");
                return;
            }

            setPermit(json.permit);
        } catch {
            setError("Permit request failed (network/server)");
        }
    }

    async function mintWithPermit() {
        if (!permit) return;

        setError(null);
        setMintMsg(null);

        try {
            const res = await fetch("/api/mint", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permit }),
            });

            const json = await res.json();

            if (!res.ok) {
                setError(json?.error ?? "Mint failed");
                return;
            }

            setMintMsg(json?.message ?? "Mint permitted ✅");
        } catch {
            setError("Mint failed (network/server)");
        }
    }

    // Автоматично підтягуємо FairScore як тільки wallet підключився/змінився
    useEffect(() => {
        if (walletAddress) {
            fetchFairScore(walletAddress);
        } else {
            setData(null);
            setPermit(null);
            setMintMsg(null);
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletAddress]);

    return (
        <main className="min-h-screen p-8">
            <div className="mx-auto max-w-2xl space-y-6">
                <header className="space-y-2">
                    <h1 className="text-3xl font-semibold">FairGate</h1>
                    <p className="text-sm text-neutral-500">
                        Reputation-gated flow powered by FairScale on Solana.
                    </p>
                </header>

                {/* Wallet connect card */}
                <section className="rounded-xl border p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-sm text-neutral-500">Wallet</p>
                            <p className="font-mono text-sm break-all">
                                {walletAddress ?? "Not connected"}
                            </p>
                        </div>

                        <WalletButtonClient />
                    </div>

                    {connected && walletAddress && (
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                className="rounded-lg border px-4 py-2 disabled:opacity-50"
                                onClick={() => fetchFairScore(walletAddress)}
                                disabled={loading}
                            >
                                {loading ? "Checking..." : "Re-check FairScore"}
                            </button>

                            <button
                                className="rounded-lg border px-4 py-2 disabled:opacity-50"
                                onClick={() => requestPermit(walletAddress)}
                                disabled={loading}
                            >
                                Request Permit
                            </button>

                            <button
                                className="rounded-lg border px-4 py-2 disabled:opacity-50"
                                onClick={mintWithPermit}
                                disabled={!permit}
                                title={!permit ? "Request Permit first" : "Permit ready"}
                            >
                                Mint (server-gated)
                            </button>

                            {permit && (
                                <span className="text-sm text-neutral-500">Permit issued ✅</span>
                            )}
                        </div>
                    )}

                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {mintMsg && <p className="text-sm text-green-600">{mintMsg}</p>}
                </section>

                {/* Score card */}
                {data && (
                    <section className="rounded-xl border p-4 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm text-neutral-500">FairScale tier</p>
                                <p className="font-semibold">{data.fairScaleTier ?? "—"}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-neutral-500">FairScore</p>
                                <p className="text-2xl font-semibold">{data.fairScore}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-neutral-500">Our tier</p>
                                <p className="font-semibold">{data.decision.tierLabel}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-neutral-500">Mint limit</p>
                                <p className="font-semibold">{data.decision.mintLimit}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-neutral-500">Mint access</p>
                                <p className="font-semibold">
                                    {data.decision.canMint ? "Unlocked" : "Locked"}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-neutral-500 mb-2">Badges</p>

                            {data.badges.length === 0 ? (
                                <p className="text-sm text-neutral-600">No badges</p>
                            ) : (
                                <ul className="space-y-2">
                                    {data.badges.map((b) => (
                                        <li key={b.id} className="rounded-md border p-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{b.label}</span>
                                                <span className="text-xs text-neutral-500">{b.tier ?? ""}</span>
                                            </div>
                                            {b.description && (
                                                <p className="text-sm text-neutral-600">{b.description}</p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="text-xs text-neutral-500">
                            Tip: Permit expires in ~10 minutes. If Mint fails, request a new permit.
                        </div>
                    </section>
                )}

                {!data && connected && walletAddress && !loading && (
                    <section className="rounded-xl border p-4 text-sm text-neutral-600">
                        No score loaded yet. Click <b>Re-check FairScore</b>.
                    </section>
                )}
            </div>
        </main>
    );
}
