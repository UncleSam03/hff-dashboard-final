import { NextResponse } from 'next/server';
import { readLocalData } from '@/lib/server/storage';

export async function POST() {
    try {
        const { writeRegister } = await import("@/lib/server/googleSheets");
        const values = await readLocalData();

        console.log(`[API] Syncing ${values.length} rows to Google Sheets...`);
        await writeRegister(values);

        return NextResponse.json({ ok: true, message: "Successfully synced to Google Sheets" });
    } catch (err) {
        console.error('[API] /api/cloud/sync error:', err);
        return NextResponse.json({
            error: "Failed to sync to cloud",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
