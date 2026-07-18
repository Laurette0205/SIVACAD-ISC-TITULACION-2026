'use strict';

const desercionService = require('../services/desercionService');
const phpDesercionBridge = require('../services/phpDesercionBridge');

class DesercionController {

  async getReportData(req, res) {
    try {
      const data = await desercionService.getReportData();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error al obtener reporte de deserción:', error);
      res.status(500).json({ success: false, message: 'Error al generar reporte' });
    }
  }

  async getResumen(req, res) {
    try {
      const resumen = await desercionService.getResumenEjecutivo();
      res.json({ success: true, data: resumen });
    } catch (error) {
      console.error('Error al obtener resumen:', error);
      res.status(500).json({ success: false, message: 'Error al obtener resumen' });
    }
  }

  async getDistribucion(req, res) {
    try {
      const data = await desercionService.getDistribucionRiesgo();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error al obtener distribución:', error);
      res.status(500).json({ success: false, message: 'Error al obtener distribución' });
    }
  }

  async getAlertasRecientes(req, res) {
    try {
      const data = await desercionService.getAlertasRecientes();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error al obtener alertas:', error);
      res.status(500).json({ success: false, message: 'Error al obtener alertas' });
    }
  }

  async generatePdf(req, res) {
    try {
      const idAlumno = req.query.alumnoId ? Number(req.query.alumnoId) : null;
      const buffer = await phpDesercionBridge.generatePdfWithPhp(idAlumno);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=reporte_desercion_sivacad.pdf');
      res.send(buffer);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      res.status(500).json({ success: false, message: 'Error al generar PDF' });
    }
  }

  async generateExcel(req, res) {
    try {
      const idAlumno = req.query.alumnoId ? Number(req.query.alumnoId) : null;
      const buffer = await phpDesercionBridge.generateExcelWithPhp(idAlumno);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_desercion_sivacad.xlsx');
      res.send(buffer);
    } catch (error) {
      console.error('Error al generar Excel:', error);
      res.status(500).json({ success: false, message: 'Error al generar Excel' });
    }
  }

  async getDashboard(req, res) {
    try {
      const [resumen, distribucion, parciales, alertas, porCarrera] = await Promise.all([
        desercionService.getResumenEjecutivo(),
        desercionService.getDistribucionRiesgo(),
        desercionService.getAnalisisParciales(),
        desercionService.getAlertasRecientes(),
        desercionService.getAnalisisPorCarrera()
      ]);
      res.json({
        success: true,
        data: { resumen, distribucion, parciales, alertas, por_carrera: porCarrera }
      });
    } catch (error) {
      console.error('Error al obtener dashboard:', error);
      res.status(500).json({ success: false, message: 'Error al obtener dashboard' });
    }
  }
}

module.exports = new DesercionController();
