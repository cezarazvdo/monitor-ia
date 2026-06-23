const pdfParse = require('pdf-parse');
const fs = require('fs');

async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return {
      text: data.text,
      pages: data.numpages,
      info: data.info,
    };
  } catch (err) {
    console.error('[PDF] Erro ao extrair texto:', err.message);
    throw new Error(`Falha ao processar PDF: ${err.message}`);
  }
}

function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { extractTextFromPDF, cleanText };
