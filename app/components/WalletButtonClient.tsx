"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function WalletButtonClient() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
        // Плейсхолдер щоб верстка не смикалась
        return (
            <button className="rounded-lg border px-4 py-2 opacity-70">
                Connect Wallet
            </button>
        );
    }

    return <WalletMultiButton />;
}
