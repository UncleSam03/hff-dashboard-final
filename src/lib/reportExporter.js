/**
 * Executive Campaign Summary Exporter
 * Generates an executive PDF report (with automatic CSV fallback)
 */

export async function exportExecutiveSummary(analytics) {
    if (!analytics) return false;

    const dateStr = new Date().toISOString().split('T')[0];

    if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Brand Header Banner
            doc.setFillColor(113, 22, 127); // #71167F HFF Purple
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setFillColor(62, 176, 73); // #3EB049 HFF Green Accent stripe
            doc.rect(0, 40, pageWidth, 2.5, 'F');

            // Header Text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('HEALTHY FAMILIES FOUNDATION', 16, 18);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('EXECUTIVE CAMPAIGN PERFORMANCE & IMPACT SUMMARY', 16, 26);
            doc.setFontSize(8);
            doc.text(`DATE GENERATED: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()} | STATUS: ADMINISTRATIVE SUMMARY`, 16, 33);

            // 1. KPI Scorecard Cards
            let y = 52;
            doc.setTextColor(30, 30, 30);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('1. Key Impact Indicators', 16, y);
            y += 6;

            const kpis = [
                { label: 'TOTAL IMPACT', val: String(analytics.totalRegistered || 0), sub: 'All Registered' },
                { label: 'PARTICIPANTS', val: String(analytics.uniqueParticipants || 0), sub: 'Unique Attendees' },
                { label: 'FACILITATORS', val: String(analytics.uniqueFacilitators || 0), sub: 'Active Support' },
                { label: 'BOOKS GIVEN', val: String(analytics.totalBooksGiven || 0), sub: 'Resources Shared' },
                { label: 'AVG ATTENDANCE', val: String(analytics.avgAttendance || 0), sub: 'Daily Density' },
                { label: 'CERTIFICATES', val: String(analytics.totalQualifyingCertificates || 0), sub: 'Qualifying' },
            ];

            const cardW = 28;
            const cardH = 20;
            const cardGap = 2.5;
            const startX = 16;

            kpis.forEach((kpi, idx) => {
                const x = startX + idx * (cardW + cardGap);
                doc.setFillColor(248, 249, 250);
                doc.setDrawColor(230, 230, 230);
                doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(120, 120, 120);
                doc.text(kpi.label, x + 2.5, y + 5.5);

                doc.setFontSize(13);
                doc.setTextColor(113, 22, 127);
                doc.text(kpi.val, x + 2.5, y + 12.5);

                doc.setFontSize(5.5);
                doc.setTextColor(150, 150, 150);
                doc.text(kpi.sub, x + 2.5, y + 17);
            });

            y += cardH + 10;

            // 2. Daily Performance Table
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 30, 30);
            doc.text('2. Day-by-Day Campaign Attendance & Retention', 16, y);
            y += 6;

            // Table Header
            doc.setFillColor(113, 22, 127);
            doc.rect(16, y, pageWidth - 32, 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('CAMPAIGN DAY', 20, y + 4.8);
            doc.text('PARTICIPANTS', 65, y + 4.8);
            doc.text('FACILITATORS', 105, y + 4.8);
            doc.text('TOTAL ACTIVE', 140, y + 4.8);
            doc.text('RETENTION RATE', 170, y + 4.8);
            y += 7;

            // Table Rows
            const dailyStats = analytics.dailyStats || [];
            dailyStats.forEach((d, idx) => {
                const isEven = idx % 2 === 0;
                doc.setFillColor(isEven ? 255 : 250, isEven ? 255 : 250, isEven ? 255 : 252);
                doc.rect(16, y, pageWidth - 32, 6.5, 'F');
                doc.setDrawColor(240, 240, 240);
                doc.line(16, y + 6.5, pageWidth - 16, y + 6.5);

                doc.setTextColor(40, 40, 40);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(d.date || `Day ${idx + 1}`, 20, y + 4.5);

                doc.setFont('helvetica', 'normal');
                doc.text(String(d.participants || 0), 65, y + 4.5);
                doc.text(String(d.facilitators || 0), 105, y + 4.5);
                
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(113, 22, 127);
                doc.text(String(d.count || 0), 140, y + 4.5);

                doc.setTextColor(62, 176, 73);
                doc.text(`${d.retention || 0}%`, 170, y + 4.5);

                y += 6.5;
            });

            y += 8;

            // 3. Demographics Summary
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 30, 30);
            doc.text('3. Demographics & Stakeholder Profile', 16, y);
            y += 6;

            const demoBoxW = (pageWidth - 32 - 4) / 2;
            const demoBoxH = 32;

            // Gender & Age Box
            doc.setFillColor(250, 250, 250);
            doc.setDrawColor(235, 235, 235);
            doc.roundedRect(16, y, demoBoxW, demoBoxH, 2, 2, 'FD');

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(113, 22, 127);
            doc.text('Gender & Age Breakdown', 20, y + 6);

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            const gender = analytics.demographics?.gender || {};
            doc.text(`• Female Attendees: ${gender['F'] || 0}`, 20, y + 13);
            doc.text(`• Male Attendees: ${gender['M'] || 0}`, 20, y + 18);
            doc.text(`• Other / Unspecified: ${(gender['OTHER'] || 0) + (gender['UNKNOWN'] || 0)}`, 20, y + 23);
            const ageSummary = (analytics.ageDistribution || []).map(a => `${a.range}: ${a.count}`).join(' | ');
            doc.text(`• Age Distribution: ${ageSummary || 'None registered'}`, 20, y + 28);

            // Education & Marital Status Box
            const box2X = 16 + demoBoxW + 4;
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(box2X, y, demoBoxW, demoBoxH, 2, 2, 'FD');

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(113, 22, 127);
            doc.text('Education & Social Profile', box2X + 4, y + 6);

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            const eduEntries = Object.entries(analytics.demographics?.education || {}).slice(0, 3).map(([k, v]) => `${k} (${v})`);
            const maritalEntries = Object.entries(analytics.demographics?.maritalStatus || {}).slice(0, 3).map(([k, v]) => `${k} (${v})`);
            doc.text(`• Top Education: ${eduEntries.join(', ') || 'None registered'}`, box2X + 4, y + 14);
            doc.text(`• Marital Profile: ${maritalEntries.join(', ') || 'None registered'}`, box2X + 4, y + 21);

            // Footer
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text('Healthy Families Foundation • Official Executive Summary • Generated by HFF Impact Engine', 16, pageHeight - 6);

            doc.save(`HFF-Executive-Summary-${dateStr}.pdf`);
            return true;
        } catch (err) {
            console.warn('PDF export encountered issue, falling back to CSV:', err);
        }
    }

    // CSV Fallback
    exportSummaryCSV(analytics, dateStr);
    return true;
}

function exportSummaryCSV(analytics, dateStr) {
    const rows = [
        ['HEALTHY FAMILIES FOUNDATION - EXECUTIVE CAMPAIGN SUMMARY'],
        ['Date Generated', dateStr],
        [],
        ['KEY IMPACT INDICATORS'],
        ['Total Impact', analytics.totalRegistered || 0],
        ['Unique Participants', analytics.uniqueParticipants || 0],
        ['Active Facilitators', analytics.uniqueFacilitators || 0],
        ['Total Books Distributed', analytics.totalBooksGiven || 0],
        ['Average Daily Attendance', analytics.avgAttendance || 0],
        ['Qualifying Certificates', analytics.totalQualifyingCertificates || 0],
        [],
        ['DAY-BY-DAY ATTENDANCE'],
        ['Day', 'Participants', 'Facilitators', 'Total Count', 'Retention Rate (%)'],
        ...(analytics.dailyStats || []).map(d => [
            d.date,
            d.participants,
            d.facilitators,
            d.count,
            `${d.retention}%`
        ]),
        [],
        ['GENDER BREAKDOWN'],
        ['Gender', 'Count'],
        ...Object.entries(analytics.demographics?.gender || {}).map(([g, c]) => [g === 'F' ? 'Female' : g === 'M' ? 'Male' : g, c]),
        [],
        ['AGE DISTRIBUTION'],
        ['Age Range', 'Count'],
        ...(analytics.ageDistribution || []).map(a => [a.range, a.count])
    ];

    const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `HFF-Executive-Summary-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
