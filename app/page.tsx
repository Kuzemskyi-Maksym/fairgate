"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";

const WalletButtonClient = dynamic(
    () => import("./components/WalletButtonClient"),
    { ssr: false }
);


type Badge = {
    id?: string;
    label?: string;
    description?: string;
    tier?: string;
};

type ScoreResponse = {
    wallet: string;
    fairscore_base?: number;
    social_score?: number;
    fairscore?: number;
    tier?: string;
    badges?: Badge[];
    timestamp?: string;
};

type PermitResponse = {
    permit: string;
    decision?: {
        tierLabel: string;
        canMint: boolean;
        mintLimit: number;
    };
};

function toTitle(s?: string) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortAddr(addr: string) {
    if (!addr) return "";
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 4)}..${addr.slice(-4)}`;
}

export default function HomePage() {
    const { publicKey, connected, signMessage } = useWallet();

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [score, setScore] = useState<ScoreResponse | null>(null);
    const [scoreLoading, setScoreLoading] = useState(false);

    const [permit, setPermit] = useState<string | null>(null);
    const [permitDecision, setPermitDecision] = useState<PermitResponse["decision"] | null>(null);

    const [mintResult, setMintResult] = useState<string | null>(null);

    const walletAddr = publicKey?.toBase58() ?? "";

    // ----------------------------
    // FETCH FAIR SCALE SCORE
    // ----------------------------
    async function fetchFairScore(addr: string) {
        setError(null);
        setScore(null);
        setPermit(null);
        setPermitDecision(null);
        setMintResult(null);

        if (!addr) return;

        try {
            setScoreLoading(true);

            // твій API-роут уже існує: /api/fairscore
            const res = await fetch(`/api/fairscore?wallet=${encodeURIComponent(addr)}`);
            const json = await res.json();

            if (!res.ok) {
                setError(json?.error ?? "FairScore fetch failed");
                return;
            }

            setScore(json as ScoreResponse);
        } catch {
            setError("FairScore request failed");
        } finally {
            setScoreLoading(false);
        }
    }

    useEffect(() => {
        if (connected && walletAddr) {
            fetchFairScore(walletAddr);
        } else {
            // reset on disconnect
            setScore(null);
            setPermit(null);
            setPermitDecision(null);
            setMintResult(null);
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, walletAddr]);

    // ----------------------------
    // REQUEST PERMIT FLOW
    // ----------------------------
    async function requestPermit(addr: string) {
        setError(null);
        setPermit(null);
        setPermitDecision(null);
        setMintResult(null);

        if (!addr) {
            setError("Wallet not connected");
            return;
        }

        if (!signMessage) {
            setError("Wallet does not support signMessage");
            return;
        }

        try {
            setLoading(true);

            // 1) challenge
            const cRes = await fetch("/api/challenge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: addr }),
            });
            const cJson = await cRes.json();

            if (!cRes.ok) {
                setError(cJson?.error ?? "Challenge failed");
                return;
            }

            // 2) sign
            const msgBytes = new TextEncoder().encode(cJson.message);
            const sigBytes = await signMessage(msgBytes);

            // 3) Uint8Array -> base64
            let binary = "";
            sigBytes.forEach((b) => (binary += String.fromCharCode(b)));
            const signatureB64 = btoa(binary);

            // 4) permit
            const pRes = await fetch("/api/permit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wallet: addr,
                    challengeToken: cJson.challengeToken,
                    signature: signatureB64,
                }),
            });

            const pJson = await pRes.json();

            if (!pRes.ok) {
                setError(pJson?.reason ?? pJson?.error ?? "Permit denied");
                return;
            }

            const pr = pJson as PermitResponse;
            setPermit(pr.permit);
            setPermitDecision(pr.decision ?? null);
        } catch {
            setError("Permit request failed");
        } finally {
            setLoading(false);
        }
    }

    // ----------------------------
    // MINT (SERVER-GATED)
    // ----------------------------
    async function mint() {
        setError(null);
        setMintResult(null);

        if (!permit) {
            setError("Permit required");
            return;
        }

        try {
            setLoading(true);

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

            setMintResult(json.message ?? "Mint success");
        } catch {
            setError("Mint request failed");
        } finally {
            setLoading(false);
        }
    }

    // ----------------------------
    // DERIVED UI STATE
    // ----------------------------
    const fairTier = useMemo(() => (score?.tier ? score.tier : "unknown"), [score?.tier]);
    const fairScore = useMemo(() => {
        const v = score?.fairscore;
        return typeof v === "number" ? Math.round(v) : null;
    }, [score?.fairscore]);

    // наш “локальний” tier для логіки доступу (з permit decision)
    const ourTierLabel = permitDecision?.tierLabel ?? (score?.tier ? toTitle(score.tier) : "—");
    const canMint = permitDecision?.canMint ?? false;
    const mintLimit = permitDecision?.mintLimit ?? 0;

    const mintAccessLabel = permit
        ? (canMint ? "Unlocked" : "Locked")
        : "Locked";

    const mintDisabledReason = !connected
        ? "Connect wallet to continue."
        : !permit
            ? "Request permit first."
            : !canMint
                ? "Mint is locked for this wallet (tier too low)."
                : null;

    // ----------------------------
    // UI (карточний, як на твоєму “старому” скріні)
    // ----------------------------
    return (
        <main
            style={{
                minHeight: "100vh",
                background: "#000",
                color: "#fff",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: 24,
            }}
        >
            <div style={{ width: "100%", maxWidth: 760 }}>
                <div style={{ marginBottom: 18 }}>
                    <h1 style={{ fontSize: 40, margin: 0, letterSpacing: 0.3 }}>FairGate</h1>
                    <div style={{ opacity: 0.7, marginTop: 6 }}>
                        Reputation-gated flow powered by FairScale on Solana.
                    </div>
                </div>

                {/* WALLET CARD */}
                <div
                    style={{
                        border: "1px solid rgba(255,255,255,0.16)",
                        borderRadius: 14,
                        padding: 16,
                        background: "rgba(255,255,255,0.03)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset",
                        marginBottom: 16,
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>Wallet</div>
                            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14 }}>
                                {connected ? walletAddr : "Not connected"}
                            </div>
                        </div>

                        <WalletButtonClient />
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                        <button
                            onClick={() => fetchFairScore(walletAddr)}
                            disabled={!connected || loading || scoreLoading}
                            style={btnStyle(false)}
                        >
                            {scoreLoading ? "Checking..." : "Re-check FairScore"}
                        </button>

                        <button
                            onClick={() => requestPermit(walletAddr)}
                            disabled={!connected || loading}
                            style={btnStyle(false)}
                        >
                            Request Permit
                        </button>

                        <button
                            onClick={mint}
                            disabled={!permit || loading || !canMint}
                            style={btnStyle(true, !permit || !canMint)}
                            title={mintDisabledReason ?? undefined}
                        >
                            Mint (server-gated)
                        </button>
                    </div>

                    {error && <div style={{ color: "#ef4444", marginTop: 12 }}>{error}</div>}

                    {permit && !error && (
                        <div style={{ color: "#4ade80", marginTop: 12 }}>
                            Permit issued ✓ {permitDecision?.tierLabel ? `(Tier: ${permitDecision.tierLabel})` : ""}
                        </div>
                    )}

                    {mintResult && !error && (
                        <div style={{ color: "#60a5fa", marginTop: 10 }}>{mintResult}</div>
                    )}
                </div>

                {/* SCORE CARD */}
                <div
                    style={{
                        border: "1px solid rgba(255,255,255,0.16)",
                        borderRadius: 14,
                        padding: 18,
                        background: "rgba(255,255,255,0.03)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                        <div>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>FairScale tier</div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{connected ? fairTier : "—"}</div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>FairScore</div>
                            <div style={{ fontSize: 28, fontWeight: 800 }}>
                                {connected ? (fairScore ?? "—") : "—"}
                            </div>
                        </div>
                    </div>

                    {/* GRID */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: 12,
                            marginTop: 14,
                        }}
                    >
                        <InfoTile label="Our tier" value={ourTierLabel} />
                        <InfoTile label="Mint limit" value={String(mintLimit)} />
                        <InfoTile label="Mint access" value={mintAccessLabel} valueColor={canMint ? "#4ade80" : "#ef4444"} />
                    </div>

                    {/* BADGES */}
                    <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>Badges</div>

                        <div
                            style={{
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 12,
                                padding: 10,
                                background: "rgba(0,0,0,0.25)",
                            }}
                        >
                            {!connected && (
                                <div style={{ opacity: 0.7 }}>Connect wallet to view badges.</div>
                            )}

                            {connected && scoreLoading && (
                                <div style={{ opacity: 0.7 }}>Loading badges...</div>
                            )}

                            {connected && !scoreLoading && (!score?.badges || score.badges.length === 0) && (
                                <div style={{ opacity: 0.7 }}>
                                    No badges found for this wallet.
                                </div>
                            )}

                            {connected && !scoreLoading && score?.badges?.length ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {score.badges.map((b, idx) => (
                                        <div
                                            key={`${b.id ?? "badge"}-${idx}`}
                                            style={{
                                                border: "1px solid rgba(255,255,255,0.12)",
                                                borderRadius: 12,
                                                padding: 12,
                                                display: "flex",
                                                justifyContent: "space-between",
                                                gap: 12,
                                                background: "rgba(255,255,255,0.02)",
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700 }}>
                                                    {b.label ?? b.id ?? "Badge"}
                                                </div>
                                                <div style={{ opacity: 0.7, fontSize: 13 }}>
                                                    {b.description ?? "—"}
                                                </div>
                                            </div>

                                            <div style={{ opacity: 0.7, fontSize: 12, textTransform: "lowercase" }}>
                                                {b.tier ?? ""}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
                        Tip: Permit expires in ~10 minutes. If Mint fails, request a new permit.
                    </div>
                </div>
            </div>
        </main>
    );
}

// ---------- UI helpers ----------
function btnStyle(isPrimary: boolean, dim?: boolean): React.CSSProperties {
    return {
        appearance: "none",
        border: "1px solid rgba(255,255,255,0.22)",
        background: isPrimary ? "rgba(255,255,255,0.08)" : "transparent",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: 12,
        cursor: dim ? "not-allowed" : "pointer",
        opacity: dim ? 0.45 : 1,
        fontWeight: 600,
    };
}

function InfoTile({
                      label,
                      value,
                      valueColor,
                  }: {
    label: string;
    value: string;
    valueColor?: string;
}) {
    return (
        <div
            style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                padding: 12,
                background: "rgba(0,0,0,0.25)",
            }}
        >
            <div style={{ fontSize: 12, opacity: 0.6 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6, color: valueColor ?? "#fff" }}>
                {value}
            </div>
        </div>
    );
}
