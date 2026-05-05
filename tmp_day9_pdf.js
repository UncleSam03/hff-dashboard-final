import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Fetch active facilitators
  const { data: facilitators, error: fErr } = await supabase
    .from('registrations')
    .select('id, uuid, first_name, last_name, contact, attendance')
    .eq('type', 'facilitator')
    .eq('is_deleted', false)

  if (fErr) { console.error("Error:", fErr.message); return; }

  const didNotAttendDay9 = facilitators.filter(r =>
    !Array.isArray(r.attendance) || r.attendance[8] !== true
  )

  const facilitatorUuids = didNotAttendDay9.filter(r => r.uuid).map(r => r.uuid)

  const { data: linkedParticipants, error: pErr } = await supabase
    .from('registrations')
    .select('facilitator_uuid')
    .eq('type', 'participant')
    .eq('is_deleted', false)
    .in('facilitator_uuid', facilitatorUuids)

  if (pErr) { console.error("Participant error:", pErr.message); return; }

  const countMap = {}
  for (const p of linkedParticipants) {
    countMap[p.facilitator_uuid] = (countMap[p.facilitator_uuid] || 0) + 1
  }

  const result = didNotAttendDay9
    .filter(r => countMap[r.uuid] > 0)
    .map(r => ({
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      contact: r.contact || 'N/A',
      liveParticipants: countMap[r.uuid]
    }))
    .sort((a, b) => b.liveParticipants - a.liveParticipants)

  console.log(`Building PDF for ${result.length} facilitators...`)

  const pdfDoc = await PDFDocument.create()
  const boldFont   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const pageWidth  = 595.28
  const pageHeight = 841.89
  const margin     = 40

  const colX = {
    num:     margin,
    name:    margin + 30,
    contact: margin + 250,
    count:   margin + 380,
  }

  const blue      = rgb(0.09, 0.39, 0.69)
  const lightBlue = rgb(0.85, 0.92, 0.98)
  const white     = rgb(1, 1, 1)
  const darkGray  = rgb(0.15, 0.15, 0.15)
  const midGray   = rgb(0.5, 0.5, 0.5)
  const rowAlt    = rgb(0.95, 0.97, 1)
  const tableW    = pageWidth - margin * 2

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y    = pageHeight - margin

  // ── Title ──────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: pageHeight - 90, width: pageWidth, height: 90, color: blue })
  page.drawText('HFF Dashboard', {
    x: margin, y: pageHeight - 35,
    font: boldFont, size: 20, color: white
  })
  page.drawText('Facilitators Who Did Not Attend Day 9 — With Active Participants', {
    x: margin, y: pageHeight - 55,
    font: regularFont, size: 11, color: rgb(0.8, 0.9, 1)
  })
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  page.drawText(`Generated: ${today}`, {
    x: margin, y: pageHeight - 73,
    font: regularFont, size: 9, color: rgb(0.75, 0.85, 0.95)
  })

  y = pageHeight - 105

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalPax = result.reduce((s, r) => s + r.liveParticipants, 0)
  page.drawText(`Facilitators listed: ${result.length}     |     Total live participants: ${totalPax}`, {
    x: margin, y,
    font: regularFont, size: 10, color: midGray
  })
  y -= 18

  // ── Draw table header ─────────────────────────────────────────────────────
  const drawHeader = (pg, yPos) => {
    pg.drawRectangle({ x: margin, y: yPos - 6, width: tableW, height: 24, color: blue })
    pg.drawText('#',                 { x: colX.num + 2,     y: yPos + 4, font: boldFont, size: 10, color: white })
    pg.drawText('Facilitator Name', { x: colX.name + 2,    y: yPos + 4, font: boldFont, size: 10, color: white })
    pg.drawText('Contact',          { x: colX.contact + 2, y: yPos + 4, font: boldFont, size: 10, color: white })
    pg.drawText('Participants',     { x: colX.count + 2,   y: yPos + 4, font: boldFont, size: 10, color: white })
    return yPos - 24
  }

  y = drawHeader(page, y)

  // ── Draw rows ─────────────────────────────────────────────────────────────
  result.forEach((row, i) => {
    const rowH = 20

    // New page check
    if (y < margin + 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      page.drawText('(continued)', { x: margin, y, font: regularFont, size: 9, color: midGray })
      y -= 14
      y = drawHeader(page, y)
    }

    // Alternating row background
    if (i % 2 === 1) {
      page.drawRectangle({ x: margin, y: y - 4, width: tableW, height: rowH, color: rowAlt })
    }

    // Separator line
    page.drawLine({
      start: { x: margin,         y: y - 4 },
      end:   { x: margin + tableW, y: y - 4 },
      thickness: 0.3,
      color: rgb(0.8, 0.8, 0.85)
    })

    page.drawText(String(i + 1),            { x: colX.num + 2,     y: y + 4, font: regularFont, size: 10, color: darkGray })
    page.drawText(row.name,                 { x: colX.name + 2,    y: y + 4, font: regularFont, size: 10, color: darkGray, maxWidth: 215 })
    page.drawText(row.contact,             { x: colX.contact + 2, y: y + 4, font: regularFont, size: 10, color: darkGray })
    page.drawText(String(row.liveParticipants), { x: colX.count + 40, y: y + 4, font: boldFont, size: 10, color: blue })

    y -= rowH
  })

  // ── Totals row ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: margin, y: y - 4, width: tableW, height: 22, color: lightBlue })
  page.drawText('TOTAL',         { x: colX.name + 2,    y: y + 5, font: boldFont, size: 10, color: blue })
  page.drawText(String(totalPax), { x: colX.count + 40, y: y + 5, font: boldFont, size: 10, color: blue })
  y -= 22

  // ── Outer border ──────────────────────────────────────────────────────────
  // (simple bottom line)
  page.drawLine({
    start: { x: margin, y: y },
    end:   { x: margin + tableW, y: y },
    thickness: 1,
    color: blue
  })

  // ── Footer ────────────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: margin, y: margin + 18 },
    end:   { x: pageWidth - margin, y: margin + 18 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8)
  })
  page.drawText('HFF Dashboard  •  Confidential  •  For Internal Use Only', {
    x: margin, y: margin + 6,
    font: regularFont, size: 8, color: midGray
  })

  // ── Save ──────────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save()
  const outPath = 'facilitators_missed_day9_with_participants.pdf'
  fs.writeFileSync(outPath, pdfBytes)
  console.log(`\n✅ PDF saved: ${outPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`)
}

run()
