import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TEMPLATE_PATH = path.join(rootDir, 'public', 'certificate_blank.pdf');
const OUTPUT_DIR = path.join(rootDir, 'dist_certificates');

const LINE_CENTER_X = 418.35;
const MAX_NAME_WIDTH = 560;
const BASE_FONT_SIZE = 36;

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

    if (textWidth > MAX_NAME_WIDTH) {
        fontSize = Math.floor(BASE_FONT_SIZE * (MAX_NAME_WIDTH / textWidth));
        textWidth = font.widthOfTextAtSize(name, fontSize);
    }

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

export async function generateSingleCertificate(name, outputPath) {
    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(`Template not found at ${TEMPLATE_PATH}`);
    }
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.getPages()[0];

    const formattedName = formatNameTitleCase(name);
    pdfDoc.setTitle(`${formattedName} - Certificate of Completion`);
    pdfDoc.setAuthor('Healthy Families Foundation');
    pdfDoc.setSubject('Certificate of Completion - Mochudi Campaign');

    drawCertificateName(page, font, formattedName);

    const pdfBytes = await pdfDoc.save();
    if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, pdfBytes);
    }
    return pdfBytes;
}

export async function generateBatchCertificates(names, combinedOutputPath = null) {
    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(`Template not found at ${TEMPLATE_PATH}`);
    }
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const masterDoc = await PDFDocument.create();
    const templateDoc = await PDFDocument.load(templateBytes);
    const font = await masterDoc.embedFont(StandardFonts.HelveticaBold);

    masterDoc.setTitle('Mochudi Campaign Certificates - Print Ready');
    masterDoc.setAuthor('Healthy Families Foundation');
    masterDoc.setSubject('Certificates of Completion - Mochudi Campaign');

    for (const rawName of names) {
        const formattedName = formatNameTitleCase(rawName);
        if (!formattedName) continue;

        const [page] = await masterDoc.copyPages(templateDoc, [0]);
        drawCertificateName(page, font, formattedName);
        masterDoc.addPage(page);
    }

    const pdfBytes = await masterDoc.save();
    if (combinedOutputPath) {
        fs.mkdirSync(path.dirname(combinedOutputPath), { recursive: true });
        fs.writeFileSync(combinedOutputPath, pdfBytes);
        console.log(`Saved combined print-ready PDF to: ${combinedOutputPath}`);
    }
    return pdfBytes;
}

// Quick CLI test if run directly
if (process.argv[1] === __filename) {
    console.log('Testing Mochudi Certificate Generation CLI...');
    const testNames = [
        'Samukeliso Moyo',
        'David Moepakgang Lesejane',
        'Neo Gaokwalelwe',
        'Kelebogile Motshegwa-Ramasu'
    ];

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    // Test single
    const singleOut = path.join(OUTPUT_DIR, 'sample_certificate.pdf');
    await generateSingleCertificate(testNames[0], singleOut);
    console.log(`Generated single certificate: ${singleOut}`);

    // Test batch
    const batchOut = path.join(OUTPUT_DIR, 'mochudi_print_all_sample.pdf');
    await generateBatchCertificates(testNames, batchOut);
    console.log(`Generated batch print-ready PDF: ${batchOut}`);
    console.log('All tests passed successfully!');
}
