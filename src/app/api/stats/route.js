import { NextResponse } from 'next/server';
import { readLocalData, writeLocalData } from '@/lib/server/storage';
import { getEnv } from '@/lib/server/env';
import { parseHffRegisterRows } from '@/lib/hffRegister';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const useCloud = searchParams.get('source') === 'cloud';

        let values;
        let sourceName = "sqlite_database";

        if (useCloud) {
            const { readRegisterValues } = await import("@/lib/server/googleSheets");
            values = await readRegisterValues();
            sourceName = "google_sheets";
            // Cache results to DB if possible
            try {
                await writeLocalData(values);
            } catch (e) {
                console.warn("Failed to cache Google Sheets data to local DB:", e.message);
            }
        } else {
            values = await readLocalData();
        }

        const parsed = parseHffRegisterRows(values);
        return NextResponse.json({
            ...parsed,
            source: sourceName,
            rawRows: values
        });
    } catch (err) {
        console.error('[API] /api/stats error:', err);
        return NextResponse.json({
            error: "Failed to load stats",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
