import React, { useState } from 'react';
import { Award, Download, Users, CheckCircle, FileText, LayoutPanelTop, ShieldCheck, UserCheck, ChevronLeft, ClipboardCheck, CalendarDays, User, Archive } from 'lucide-react';
import StatsCard from './StatsCard';
import { cn } from '../lib/utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';

const SatDashboard = ({ analytics, onBack }) => {
    const [view, setView] = useState('main'); // 'main', 'certificates', 'certificates_facilitators', 'certificates_participants', 'attendance', 'attendance_facilitators', 'attendance_participants'

    const handleBack = () => {
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
        if (view === 'certificates_facilitators') return 'Facilitators who attended at least 8 days';
        if (view === 'certificates_participants') return 'Participants who attended at least 8 days';
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

    const exportAllAsZip = async (type) => {
        const list = type === 'facilitators' ? analytics?.qualifyingFacilitatorsList : analytics?.qualifyingParticipantsList;
        if (!list || list.length === 0) return;

        try {
            setIsExportingZip(true);
            const zip = new JSZip();
            const url = '/certificate_blank.pdf';
            const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());

            for (const person of list) {
                const pdfDoc = await PDFDocument.load(existingPdfBytes);
                const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                
                const pages = pdfDoc.getPages();
                const firstPage = pages[0];
                const { width, height } = firstPage.getSize();
                
                const name = `${person.first_name || ''} ${person.last_name || ''}`.trim();
                if (!name) continue;

                pdfDoc.setTitle(`${name} Certificate`);
                
                const fontSize = 42;
                const textWidth = font.widthOfTextAtSize(name, fontSize);
                
                firstPage.drawText(name, {
                    x: (width / 2) - (textWidth / 2),
                    y: (height / 2) + 112, 
                    size: fontSize,
                    font: font,
                    color: rgb(0.2, 0.2, 0.2),
                });

                const pdfBytes = await pdfDoc.save();
                zip.file(`${name.replace(/[^a-z0-9]/gi, '_')}_Certificate.pdf`, pdfBytes);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const blobUrl = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `Qualifying_${type.charAt(0).toUpperCase() + type.slice(1)}_Certificates.zip`;
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

    const [isGenerating, setIsGenerating] = useState(false);

    const generateAndShowCertificate = async (person) => {
        if (!person) return;
        try {
            setIsGenerating(true);
            const url = '/certificate_blank.pdf';
            const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());

            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const { width, height } = firstPage.getSize();
            
            const name = `${person.first_name || ''} ${person.last_name || ''}`.trim();
            
            // Set the PDF metadata title so the browser tab shows the name instead of a UUID
            pdfDoc.setTitle(`${name} Certificate`);

            const fontSize = 42;
            const textWidth = font.widthOfTextAtSize(name, fontSize);
            
            // Position name on the line above "Is recognized for completing the..."
            // In PDF coordinates, 0,0 is bottom-left, so increasing Y moves it up.
            firstPage.drawText(name, {
                x: (width / 2) - (textWidth / 2),
                y: (height / 2) + 112, 
                size: fontSize,
                font: font,
                color: rgb(0.2, 0.2, 0.2),
            });

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
                    <div key={index} className="glass-card p-6 flex items-center justify-between group hover:border-[#71167F]/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#71167F]/10 group-hover:text-[#71167F] transition-colors">
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
        const safeList = list || [];

        return (
            <div className="max-w-4xl mx-auto w-full space-y-8">
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => exportToTxt(type)}
                        disabled={safeList.length === 0}
                        className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#71167F] hover:shadow-xl hover:shadow-[#71167F]/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={14} />
                        Export to TXT
                    </button>
                    <button 
                        onClick={() => exportAllAsZip(type)}
                        disabled={safeList.length === 0 || isExportingZip}
                        className="px-6 py-3 bg-[#71167F] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#5C0F66] hover:shadow-xl hover:shadow-[#71167F]/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Archive size={14} />
                        {isExportingZip ? 'Generating ZIP...' : 'Export PDFs (ZIP)'}
                    </button>
                </div>

                <div className="glass-card p-8 bg-white/50">
                    {safeList.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No qualifying {type} found yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {safeList.map((person, index) => (
                                <div 
                                    key={person.id || index} 
                                    onClick={() => generateAndShowCertificate(person)}
                                    className={`p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-[#71167F]/30 hover:shadow-md transition-all ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}
                                    title="Click to view certificate"
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
                        className="px-6 py-3 bg-white border border-gray-100 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-[#71167F] hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
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
                        <div onClick={() => setView('certificates')} className="cursor-pointer">
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
                        <div onClick={() => setView('certificates_facilitators')} className="cursor-pointer">
                            <StatsCard
                                title="Facilitators"
                                value={analytics?.qualifyingFacilitators || 0}
                                icon={UserCheck}
                                description="Qualifying facilitator certificates"
                                color="blue"
                                className="hover:ring-2 hover:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <div onClick={() => setView('certificates_participants')} className="cursor-pointer">
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
