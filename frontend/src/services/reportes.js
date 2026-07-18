import { api } from './api';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function extractFilename(disposition, fallback) {
  if (!disposition) return fallback;
  const match = disposition.match(/filename[^;=\n]*=["']?([^"';\n]*)["']?/);
  return match && match[1] ? match[1] : fallback;
}

export const reportes = {
  async getPreview(token, id) {
    return api.kardexPreview(token, id);
  },

  async getMyPreview(token) {
    return api.kardexMyPreview(token);
  },

  async downloadPDF(token, id) {
    const blob = await api.kardexExportPDF(token, id);
    downloadBlob(blob, `kardex_${id}.pdf`);
    return blob;
  },

  async downloadExcel(token, id) {
    const blob = await api.kardexExportExcel(token, id);
    downloadBlob(blob, `kardex_${id}.xlsx`);
    return blob;
  },

  async downloadMyPDF(token) {
    const blob = await api.kardexMyPDF(token);
    downloadBlob(blob, 'kardex_personal.pdf');
    return blob;
  },

  async downloadMyExcel(token) {
    const blob = await api.kardexMyExcel(token);
    downloadBlob(blob, 'kardex_personal.xlsx');
    return blob;
  },

  async getDesercionPreview(token) {
    const resp = await api.desercionReportePreview(token);
    return resp;
  },

  async getDesercionDashboard(token) {
    const resp = await api.desercionReporteDashboard(token);
    return resp;
  },

  async downloadDesercionPDF(token) {
    const blob = await api.desercionReportePdf(token);
    downloadBlob(blob, 'reporte_desercion_sivacad.pdf');
    return blob;
  },

  async downloadDesercionExcel(token) {
    const blob = await api.desercionReporteExcel(token);
    downloadBlob(blob, 'reporte_desercion_sivacad.xlsx');
    return blob;
  }
};

export default reportes;
