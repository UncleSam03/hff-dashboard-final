import React, { useState } from 'react';
import { Award, Download, Users, CheckCircle, FileText, LayoutPanelTop, ShieldCheck, UserCheck, ChevronLeft, ClipboardCheck, CalendarDays, User, Archive, Search, Printer } from 'lucide-react';
import StatsCard from './StatsCard';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { MIN_QUALIFYING_DAYS } from '../lib/constants';

const CERT_URL = '/certificate_blank.pdf?v=mochudi-final-print-2026';
const LINE_CENTER_X = 418.35; // Visual center of Mochudi recipient line & 'Is recognized...'
const MAX_NAME_WIDTH = 560;   // Comfortable inner margin on the 636.85 pt line
const BASE_FONT_SIZE = 36;    // Optimal balance between prestige, legibility, and line clearance

const formatNameTitleCase = (name) => {
    if (!name) return '';
    return name
        .split(' ')
        .filter(part => part.trim().length > 0)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
};

const drawCertificateName = (page, font, name) => {
    let fontSize = BASE_FONT_SIZE;
    let textWidth = font.widthOfTextAtSize(name, fontSize);

    // Dynamically scale down for long names so they never overflow the line
    if (textWidth > MAX_NAME_WIDTH) {
        fontSize = Math.floor(BASE_FONT_SIZE * (MAX_NAME_WIDTH / textWidth));
        textWidth = font.widthOfTextAtSize(name, fontSize);
    }

    // Baseline Y = 422 pt provides 2-4 pt clean clearance for descenders ('y', 'g', 'j', 'p', 'q')
    // above the line (at Y=405), and stays comfortably beneath the 'Of' flourish (bottom at Y=458.7).
    const baselineY = 422 - (BASE_FONT_SIZE - fontSize) * 0.2;
    const x = LINE_CENTER_X - (textWidth / 2);

    page.drawText(name, {
        x,
        y: baselineY,
        size: fontSize,
        font,
        color: rgb(0.12, 0.12, 0.12),
    });
};

const SatDashboard = ({ analytics, onBack }) => {
    const [view, setView] = useState('main'); // 'main', 'certificates', 'certificates_facilitators', 'certificates_participants', 'attendance', 'attendance_facilitators', 'attendance_participants'
    const [searchQuery, setSearchQuery] = useState('');

    const handleBack = () => {
        setSearchQuery('');
        if (view.startsWith('attendance_')) {
            setView('attendance');
        } else if (view.startsWith('certificates_')) {
            setView('certificates');
        } else {
            setView('main');
        }
    };

    const getTitle = () => {
        if (view === 'certificates') return 'Certificates';
        if (view === 'certificates_facilitators') return 'Qualifying Facilitators';
        if (view === 'certificates_participants') return 'Qualifying Participants';
        if (view === 'attendance') return 'Attendance Overview';
        if (view === 'attendance_facilitators') return 'Facilitator Attendance';
        if (view === 'attendance_participants') return 'Participant Attendance';
        return 'SAT Dashboard';
    };

    const getDescription = () => {
        if (view === 'certificates') return 'Select certificate category to manage records';
        if (view === 'certificates_facilitators') return `Facilitators who attended at least ${MIN_QUALIFYING_DAYS} days`;
        if (view === 'certificates_participants') return `Participants who attended at least ${MIN_QUALIFYING_DAYS} days`;
        if (view === 'attendance') return 'Select category to view daily attendance logs';
        if (view === 'attendance_facilitators') return 'Daily attendance breakdown for facilitators';
        if (view === 'attendance_participants') return 'Daily attendance breakdown for participants';
        return 'Strategic Action Team Performance & Certification';
    };

    const exportToTxt = (type) => {
        const list = type === 'facilitators' ? analytics?.qualifyingFacilitatorsList : analytics?.qualifyingParticipantsList;
        if (!list || list.length === 0) return;

        const content = list.map((p, index) => `${index + 1}. ${p.first_name || ''} ${p.last_name || ''}`.trim()).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Qualifying_${type.charAt(0).toUpperCase() + type.slice(1)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const [isExportingZip, setIsExportingZip] = useState(false);
    const [isGeneratingCombined, setIsGeneratingCombined] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const exportAllAsZip = async (type) => {
        const list = type === 'facilitators' ? analytics?.qualifyingFacilitatorsList : analytics?.qualifyingParticipantsList;
        if (!list || list.length === 0) return;

        try {
            setIsExportingZip(true);
            const zip = new JSZip();
            const existingPdfBytes = await fetch(CERT_URL).then(res => res.arrayBuffer());

            for (const person of list) {
                const rawName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
                const name = formatNameTitleCase(rawName);
                if (!name) continue;

                const pdfDoc = await PDFDocument.load(existingPdfBytes);
                const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                const pages = pdfDoc.getPages();
                const firstPage = pages[0];

                pdfDoc.setTitle(`${name} - Certificate of Completion`);
                pdfDoc.setAuthor('Healthy Families Foundation');
                pdfDoc.setSubject('Certificate of Completion - Mochudi Campaign');

                drawCertificateName(firstPage, font, name);

                const pdfBytes = await pdfDoc.save();
                zip.file(`${name.replace(/[^a-z0-9]/gi, '_')}_Certificate.pdf`, pdfBytes);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const blobUrl = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `Qualifying_${type.charAt(0).toUpperCase() + type.slice(1)}_Certificates_ZIP.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            
        } catch (error) {
            console.error("Error generating zip:", error);
            alert("Could not generate ZIP file.");
        } finally {
            setIsExportingZip(false);
        }
    };

    const exportAllAsCombinedPdf = async (type) => {
        const list = type === 'facilitators' ? analytics?.qualifyingFacilitatorsList : analytics?.qualifyingParticipantsList;
        if (!list || list.length === 0) return;

        try {
            setIsGeneratingCombined(true);
            const existingPdfBytes = await fetch(CERT_URL).then(res => res.arrayBuffer());

            const masterDoc = await PDFDocument.create();
            const templateDoc = await PDFDocument.load(existingPdfBytes);
            const font = await masterDoc.embedFont(StandardFonts.HelveticaBold);

            for (const person of list) {
                const rawName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
                const name = formatNameTitleCase(rawName);
                if (!name) continue;

                const [page] = await masterDoc.copyPages(templateDoc, [0]);
                drawCertificateName(page, font, name);
                masterDoc.addPage(page);
            }

            const docTitle = `Qualifying ${type === 'facilitators' ? 'Facilitators' : 'Participants'} Certificates - Mochudi`;
            masterDoc.setTitle(docTitle);
            masterDoc.setAuthor('Healthy Families Foundation');
            masterDoc.setSubject('Certificate of Completion - Mochudi Campaign');

            const pdfBytes = await masterDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);

            // Open print-ready combined PDF in a new tab for instant browser printing (Ctrl+P)
            window.open(blobUrl, '_blank');

            // Also trigger a direct download of the print bundle
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `Qualifying_${type.charAt(0).toUpperCase() + type.slice(1)}_Certificates_PRINT_ALL.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error("Error generating combined print-ready PDF:", error);
            alert("Could not generate combined print-ready PDF.");
        } finally {
            setIsGeneratingCombined(false);
        }
    };

    const generateAndShowCertificate = async (person) => {
        if (!person) return;
        try {
            setIsGenerating(true);
            const existingPdfBytes = await fetch(CERT_URL).then(res => res.arrayBuffer());

            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            
            const rawName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
            const name = formatNameTitleCase(rawName);
            
            pdfDoc.setTitle(`${name} - Certificate of Completion`);
            pdfDoc.setAuthor('Healthy Families Foundation');
            pdfDoc.setSubject('Certificate of Completion - Mochudi Campaign');

            drawCertificateName(firstPage, font, name);

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            
            window.open(blobUrl, '_blank');
        } catch (error) {
            console.error("Error generating certificate:", error);
            alert("Could not generate certificate. Please ensure the blank PDF is available.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Safe fallback for dailyStats
    const dailyStats = analytics?.dailyStats || Array.from({ length: 12 }, (_, i) => ({
        date: `Day ${i + 1}`,
        participants: 0,
        facilitators: 0
    }));

    const renderVerticalCards = (type) => {
        return (
            <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
                {dailyStats.map((stat, index) => (
                    <div key={index} className="liquid-glass-elevated p-6 flex items-center justify-between group border border-white/70 hover:border-[#71167F]/40 transition-all relative overflow-hidden">
                        {/* Specular top rim */}
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-white/70 border border-white/60 flex items-center justify-center text-gray-500 group-hover:bg-[#71167F]/10 group-hover:text-[#71167F] transition-colors shadow-sm">
                                <CalendarDays size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900">{stat.date}</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                                    {type === 'facilitators' ? 'Active Facilitators' : 'Active Participants'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-black text-[#71167F]">
                                {type === 'facilitators' ? stat.facilitators : stat.participants}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderCertificateList = (type) => {
        const list = type === 'facilitators' ? analytics?.qualifyingFacilitatorsList : analytics?.qualifyingParticipantsList;
        
        const sortedList = (list || []).slice().sort((a, b) => {
            const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
            const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });

        const safeList = sortedList.filter(person => {
            const name = `${person.first_name || ''} ${person.last_name || ''}`.trim().toLowerCase();
            return name.includes(searchQuery.toLowerCase());
        });

        return (
            <div className="max-w-4xl mx-auto w-full space-y-8">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search names..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 liquid-glass-input rounded-full text-xs font-medium focus:border-[#71167F] outline-none"
                        />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2.5">
                        <button 
                            onClick={() => exportToTxt(type)}
                            disabled={safeList.length === 0}
                            className="px-4 py-2.5 liquid-glass-pill text-gray-700 font-bold text-[10px] uppercase tracking-wider hover:text-[#71167F] hover:border-[#71167F]/30 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Export list of names as text file"
                        >
                            <Download size={13} />
                            Export TXT
                        </button>
                        <button 
                            onClick={() => exportAllAsZip(type)}
                            disabled={safeList.length === 0 || isExportingZip || isGeneratingCombined}
                            className="px-4 py-2.5 liquid-glass-pill text-gray-700 font-bold text-[10px] uppercase tracking-wider hover:text-[#71167F] hover:border-[#71167F]/30 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Export all individual certificates as a ZIP archive"
                        >
                            <Archive size={13} />
                            {isExportingZip ? 'Generating ZIP...' : 'Export ZIP'}
                        </button>
                        <button 
                            onClick={() => exportAllAsCombinedPdf(type)}
                            disabled={safeList.length === 0 || isGeneratingCombined || isExportingZip}
                            className="px-5 py-2.5 hff-gradient-bg text-white rounded-full font-bold text-[10px] uppercase tracking-wider hover:opacity-95 shadow-md shadow-[#71167F]/25 transition-all flex items-center gap-2 border border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Compile all certificates into a single print-ready PDF"
                        >
                            <Printer size={13} />
                            {isGeneratingCombined ? 'Preparing Print...' : 'Print All (Combined PDF)'}
                        </button>
                    </div>
                </div>

                <div className="glass-card p-8 bg-white/50">
                    {safeList.length === 0 ? (
                        <div className="text-center py-14">
                            <FileText size={44} className="mx-auto text-gray-300 mb-3" />
                            {searchQuery ? (
                                <>
                                    <p className="text-gray-800 font-bold mb-1">No matching records</p>
                                    <p className="text-gray-400 text-xs mb-3">No qualifying {type} match "{searchQuery}".</p>
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="text-xs font-bold text-[#71167F] hover:underline"
                                    >
                                        Clear Search
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-gray-800 font-bold mb-1">No qualifying {type} yet</p>
                                    <p className="text-gray-400 text-xs">
                                        Certificates require at least {MIN_QUALIFYING_DAYS} days of recorded attendance.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {safeList.map((person, index) => (
                                <div 
                                    key={person.id || index} 
                                    onClick={() => generateAndShowCertificate(person)}
                                    className={`p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-[#71167F]/30 hover:shadow-md transition-all ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}
                                    title="Click to preview & print certificate"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-[#71167F]/5 flex items-center justify-center text-[#71167F]">
                                        <User size={18} />
                                    </div>
                                    <div className="truncate">
                                        <h4 className="text-sm font-black text-gray-900 truncate group-hover:text-[#71167F] transition-colors">
                                            {person.first_name} {person.last_name}
                                        </h4>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 truncate">
                                            {person.school || person.organization || 'No Affiliation'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-[1600px] mx-auto pb-24">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-4">
                        {view !== 'main' && (
                            <button 
                                onClick={handleBack}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-[#71167F]"
                            >
                                <ChevronLeft size={24} />
                            </button>
                        )}
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                            <span className="p-3 hff-gradient-bg rounded-2xl text-white shadow-2xl shadow-[#71167F]/20 rotate-3">
                                <ShieldCheck size={32} />
                            </span>
                            {getTitle()}
                        </h1>
                    </div>
                    <p className="text-gray-400 font-bold mt-3 uppercase text-[10px] tracking-[0.3em]">
                        {getDescription()}
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="px-5 py-2.5 liquid-glass-pill text-gray-600 font-bold text-[10px] uppercase tracking-wider hover:text-[#71167F] hover:border-[#71167F]/30 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <LayoutPanelTop size={14} />
                        Back to Home
                    </button>
                </div>
            </div>

            {/* Content Section */}
            <div className="animate-in fade-in zoom-in duration-500">
                {view === 'main' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div onClick={() => { setView('certificates'); setSearchQuery(''); }} className="cursor-pointer">
                            <StatsCard
                                title="Certificates"
                                value={analytics?.totalQualifyingCertificates || 0}
                                icon={Award}
                                description="Total certificates to be issued"
                                color="purple"
                                className="hover:ring-2 hover:ring-[#71167F]/20 transition-all"
                            />
                        </div>
                        <div onClick={() => setView('attendance')} className="cursor-pointer">
                            <StatsCard
                                title="Attendance"
                                value={analytics?.avgAttendance || 0}
                                icon={ClipboardCheck}
                                description="Avg daily attendance"
                                color="amber"
                                className="hover:ring-2 hover:ring-amber-500/20 transition-all"
                            />
                        </div>
                    </div>
                ) : view === 'certificates' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div onClick={() => { setView('certificates_facilitators'); setSearchQuery(''); }} className="cursor-pointer">
                            <StatsCard
                                title="Facilitators"
                                value={analytics?.qualifyingFacilitators || 0}
                                icon={UserCheck}
                                description="Qualifying facilitator certificates"
                                color="blue"
                                className="hover:ring-2 hover:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <div onClick={() => { setView('certificates_participants'); setSearchQuery(''); }} className="cursor-pointer">
                            <StatsCard
                                title="Participants"
                                value={analytics?.qualifyingParticipants || 0}
                                icon={Users}
                                description="Qualifying participant certificates"
                                color="green"
                                className="hover:ring-2 hover:ring-green-500/20 transition-all"
                            />
                        </div>
                    </div>
                ) : view === 'certificates_facilitators' ? (
                    renderCertificateList('facilitators')
                ) : view === 'certificates_participants' ? (
                    renderCertificateList('participants')
                ) : view === 'attendance' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div onClick={() => setView('attendance_facilitators')} className="cursor-pointer">
                            <StatsCard
                                title="Facilitators"
                                value={analytics?.uniqueFacilitators || 0}
                                icon={UserCheck}
                                description="Facilitator attendance logs"
                                color="blue"
                                className="hover:ring-2 hover:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <div onClick={() => setView('attendance_participants')} className="cursor-pointer">
                            <StatsCard
                                title="Participants"
                                value={analytics?.uniqueParticipants || 0}
                                icon={Users}
                                description="Participant attendance logs"
                                color="green"
                                className="hover:ring-2 hover:ring-green-500/20 transition-all"
                            />
                        </div>
                    </div>
                ) : view === 'attendance_facilitators' ? (
                    renderVerticalCards('facilitators')
                ) : view === 'attendance_participants' ? (
                    renderVerticalCards('participants')
                ) : null}
            </div>

        </div>
    );
};

export default SatDashboard;
