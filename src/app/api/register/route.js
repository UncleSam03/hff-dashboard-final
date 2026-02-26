import { NextResponse } from 'next/server';
import { writeLocalData } from '@/lib/server/storage';
import { getEnv } from '@/lib/server/env';
import { parseHffRegisterRows } from '@/lib/hffRegister';

export async function PUT(req) {
    try {
        const { rows } = await req.json();
        if (!Array.isArray(rows) || !rows.every((r) => Array.isArray(r))) {
            return NextResponse.json({ error: "Body must be { rows: any[][] }" }, { status: 400 });
        }

        await writeLocalData(rows);

        // Optional: Auto-sync to cloud
        const autoSync = getEnv("HFF_AUTO_SYNC_CLOUD", { defaultValue: "false" }) === "true";
        if (autoSync) {
            try {
                const { writeRegister } = await import("@/lib/server/googleSheets");
                await writeRegister(rows);
            } catch (cloudErr) {
                console.error("[API] Auto-sync failed:", cloudErr.message);
            }
        }

        const parsed = parseHffRegisterRows(rows);
        return NextResponse.json({ ok: true, ...parsed, rawRows: rows });
    } catch (err) {
        console.error('[API] /api/register error:', err);
        return NextResponse.json({
            error: "Failed to write register",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
