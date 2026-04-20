import React, { useState, useEffect } from 'react';
import { db } from '../lib/dexieDb';
import { mergeDuplicateRegistrations } from '../lib/dataMaintenance';
import { syncSubmissions } from '../lib/syncManager';
import { Trash2, AlertTriangle, CheckCircle, Search, Layers, ArrowRight } from 'lucide-react';

const MaintenanceTool = () => {
    const [duplicates, setDuplicates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [scanning, setScanning] = useState(false);

    const scanForDuplicates = async () => {
        setScanning(true);
        try {
            const scanResult = await mergeDuplicateRegistrations({ dryRun: true });
            setDuplicates(scanResult.results || []);
        } catch (err) {
            console.error("Scan error:", err);
        } finally {
            setScanning(false);
        }
    };

    useEffect(() => {
        scanForDuplicates();
    }, []);

    const handleMerge = async () => {
        if (!window.confirm("Are you sure you want to merge these duplicates? This will permanently delete redundant local records and update the master entries.")) {
            return;
        }

        setLoading(true);
        try {
            const mergeResult = await mergeDuplicateRegistrations({ dryRun: false });
            setResult(mergeResult);
            
            // Trigger an immediate sync to push the updated master records
            console.log("[MaintenanceTool] Triggering post-merge cloud sync...");
            await syncSubmissions();
            
            // Re-scan to update the list
            await scanForDuplicates();
        } catch (err) {
            console.error("Merge error:", err);
            alert("An error occurred during merging.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Layers className="text-hff-primary" />
                        Data Deduplication Tool
                    </h1>
                    <p className="text-gray-500 text-sm">Merge duplicate entries based on Name, Age, and Affiliation.</p>
                </div>
                <button
                    onClick={scanForDuplicates}
                    disabled={scanning}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <Search className="h-4 w-4" />
                    {scanning ? 'Scanning...' : 'Refresh List'}
                </button>
            </div>

            {result && (
                <div className="mb-8 p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-green-800">Merge Successful</h3>
                        <p className="text-green-700 text-sm">
                            Processed {result.duplicatesMerged} sets of duplicates and removed {result.recordsDeleted} redundant records.
                        </p>
                        <button onClick={() => setResult(null)} className="text-xs font-bold text-green-800 mt-2 underline">Dismiss</button>
                    </div>
                </div>
            )}

            {duplicates.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4 opacity-50" />
                    <p className="text-gray-500 font-medium">No duplicates found in local storage!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-4 mb-6">
                        <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                        <div>
                            <p className="text-amber-800 font-medium">Found {duplicates.length} potential duplicates</p>
                            <p className="text-amber-700 text-sm mb-4">
                                Merging will combine all available information (contact, occupation, attendance) into the most recent record.
                            </p>
                            <button
                                onClick={handleMerge}
                                disabled={loading}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? 'Merging...' : 'Merge All Duplicates Now'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Participant</th>
                                    <th className="px-6 py-4">Duplicates Count</th>
                                    <th className="px-6 py-4">Action Preview</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {duplicates.map((dup, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800">{dup.masterName}</div>
                                            <div className="text-xs text-gray-400">UUID: {dup.masterUuid.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {dup.othersUuids.length} redundant {dup.othersUuids.length === 1 ? 'record' : 'records'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 italic">
                                            {dup.changesApplied ? 'Fields will be enriched' : 'Redundant records will be deleted'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceTool;
