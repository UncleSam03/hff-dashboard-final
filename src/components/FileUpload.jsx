import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";
import { parseHffRegisterRows } from "@/lib/hffRegister";

const FileUpload = ({ onDataLoaded }) => {
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);

    const onDrop = useCallback((acceptedFiles) => {
        setError(null);
        const file = acceptedFiles[0];
        if (!file) return;

        setProcessing(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                processData(jsonData);
            } catch (err) {
                console.error(err);
                setError("Failed to parse file. Please ensure it matches the HFF template.");
                setProcessing(false);
            }
        };

        reader.readAsArrayBuffer(file);
    }, [onDataLoaded]);

    const processData = (rows) => {
        try {
            console.log('Processing Excel rows:', rows.length, 'rows');
            const { participants, analytics, campaignDates, skippedRows } = parseHffRegisterRows(rows);

            console.log('Parsed data:', {
                participantsCount: participants?.length,
                analytics,
                campaignDates,
                skippedRowsCount: skippedRows?.length
            });

            // Validate that we have the required data structure
            if (!analytics || !campaignDates) {
                throw new Error('Parsing failed: Missing analytics or campaignDates in parsed data');
            }

            onDataLoaded({ participants, analytics, campaignDates, skippedRows, rawRows: rows });
            setProcessing(false);
        } catch (err) {
            console.error('Error processing data:', err);
            setError(err.message || 'Failed to process file data. Please check the file format.');
            setProcessing(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv']
        },
        multiple: false
    });

    return (
        <div className="w-full max-w-2xl mx-auto mb-8">
            <div
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed rounded-xl p-8 transition-colors duration-200 cursor-pointer flex flex-col items-center justify-center text-center",
                    isDragActive ? "border-hff-primary bg-hff-primary/5" : "border-gray-200 hover:border-hff-primary/50 bg-white",
                    error && "border-red-500 bg-red-50"
                )}
            >
                <input {...getInputProps()} />

                {processing ? (
                    <div className="flex flex-col items-center animate-pulse">
                        <Loader2 className="h-10 w-10 text-hff-primary animate-spin mb-4" />
                        <p className="text-gray-600 font-medium">Processing attendance data...</p>
                    </div>
                ) : (
                    <>
                        <div className="h-14 w-14 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-hff-primary">
                            <FileSpreadsheet className="h-7 w-7" />
                        </div>
                        {isDragActive ? (
                            <p className="text-hff-primary font-bold text-lg">Drop the file here...</p>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-gray-900 font-semibold text-lg">
                                    Drag & drop headers file or <span className="text-hff-primary underline">browse</span>
                                </p>
                                <p className="text-sm text-gray-500">
                                    Supports .xlsx, .xls, .csv (HFF Format)
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 mt-4 text-red-600 bg-red-50 p-3 rounded-lg text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default FileUpload;
