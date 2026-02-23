import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Share2 } from 'lucide-react';

const AIReport = ({ analytics }) => {
    if (!analytics) return null;

    const generateTextReport = () => {
        const { totalRegistered, uniqueAttendees, avgAttendance, dailyStats, demographics } = analytics;
        const peakDay = dailyStats.reduce((prev, current) => (prev.count > current.count) ? prev : current, dailyStats[0] || {});
        const females = demographics.gender['F'] || 0;
        const femalePct = ((females / totalRegistered) * 100).toFixed(1);

        return `
CAMPAIGN IMPACT SUMMARY REPORT

During the campaign, The Healthy Families Foundation successfully registered ${totalRegistered} participants. 
Of these, ${uniqueAttendees} individuals attended at least one session, demonstrating strong community engagement.

Participation Trends:
The campaign saw an average daily attendance of ${avgAttendance} participants. The most active day was ${peakDay.date} with ${peakDay.count} attendees.

Demographic Highlights:
Women were significant drivers of participation, accounting for ${femalePct}% of all attendees. 
Educationally, the cohort showed diverse backgrounds, with key representation from ${Object.keys(demographics.education).join(', ')} levels.

Impact Statement:
This data reflects sustained community interest and validates the need for continued HFF presence in the region.
        `.trim();
    };

    const downloadPDF = async () => {
        const btn = document.getElementById('download-btn');
        const originalText = btn.innerText;
        btn.innerText = "Generating...";
        btn.disabled = true;

        try {
            const { jsPDF } = window.jspdf;
            const html2canvas = window.html2canvas;

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // 1. Add Header
            doc.setFillColor(31, 41, 55); // Dark gray
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.text('HFF CAMPAIGN IMPACT REPORT', 15, 20);
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, 30);

            // 2. Add AI Insights
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(16);
            doc.text('AI Strategic Insights', 15, 55);
            doc.setFontSize(11);
            doc.setTextColor(75, 85, 99);

            const splitText = doc.splitTextToSize(generateTextReport(), pageWidth - 30);
            doc.text(splitText, 15, 65);

            // 3. Add Visuals (Capture Charts)
            // We'll try to find the charts area. In Dashboard.jsx they are in specific grids.
            // For now, let's capture the main grid components if they exist
            const chartElements = document.querySelectorAll('.recharts-wrapper');

            if (chartElements.length > 0) {
                doc.addPage();
                doc.setTextColor(31, 41, 55);
                doc.setFontSize(16);
                doc.text('Data Visualizations', 15, 20);

                let currentY = 30;

                for (let i = 0; i < chartElements.length; i++) {
                    const canvas = await html2canvas(chartElements[i]);
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = pageWidth - 40;
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    if (currentY + pdfHeight > 280) {
                        doc.addPage();
                        currentY = 20;
                    }

                    doc.addImage(imgData, 'PNG', 20, currentY, pdfWidth, pdfHeight);
                    currentY += pdfHeight + 15;
                }
            }

            doc.save(`HFF-Report-${new Date().getTime()}.pdf`);
        } catch (error) {
            console.error('PDF Generation failed:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    };

    return (
        <Card className="col-span-full shadow-sm border-gray-100 mb-8 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-hff-secondary fill-hff-secondary/20" />
                    AI Generated Insights
                </CardTitle>
                <button
                    id="download-btn"
                    onClick={downloadPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-hff-primary text-white rounded-lg text-sm font-bold hover:bg-hff-primary/90 transition-all shadow-md shadow-hff-primary/20"
                >
                    <Share2 className="h-4 w-4" />
                    Download Report
                </button>
            </CardHeader>
            <CardContent>
                <textarea
                    className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-mono text-sm leading-relaxed focus:ring-2 focus:ring-hff-primary focus:border-transparent outline-none resize-none"
                    readOnly
                    value={generateTextReport()}
                />
            </CardContent>
        </Card>
    );
};

export default AIReport;
