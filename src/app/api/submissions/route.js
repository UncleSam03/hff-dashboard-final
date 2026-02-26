import { NextResponse } from 'next/server';
import { readLocalData, appendLocalData } from '@/lib/server/storage';

export async function POST(req) {
    try {
        const { xml } = await req.json();
        if (!xml) {
            return NextResponse.json({ error: "Body must contain 'xml'" }, { status: 400 });
        }

        const { enketoToHffRow } = await import("@/lib/server/enketoMapper");

        // Fetch existing values to determine next ID
        const values = await readLocalData();
        const nextId = values.length - 1;

        const row = enketoToHffRow(xml, nextId);
        if (!row) {
            return NextResponse.json({ error: "Failed to parse XML submission" }, { status: 400 });
        }

        await appendLocalData(row);

        return NextResponse.json({ ok: true, id: nextId });
    } catch (err) {
        console.error('[API] /api/submissions error:', err);
        return NextResponse.json({
            error: "Failed to sync submission",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
