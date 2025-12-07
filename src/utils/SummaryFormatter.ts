import { ColorDetectionResult } from '../services/ImageProcessorService.js';
import { AlertStatus } from '../services/HTMLGeneratorService.js';

/**
 * Utilidades para formatear resúmenes y presentación de información
 */
export class SummaryFormatter {
    /**
     * Genera un resumen formateado del estado actual de la playa
     * @param detection - Resultado de la detección de colores
     * @param alertStatus - Estado de alerta actual
     * @returns String formateado con el resumen
     */
    static generateSummary(detection: ColorDetectionResult, alertStatus: AlertStatus): string {
        const lines = [
            '╔══════════════════════════════════════════════════════════════╗',
            '║               RESUMEN DE ESTADO DE PLAYA                     ║',
            '╚══════════════════════════════════════════════════════════════╝',
            '',
            `📊 Detección de Colores:`,
            `   🔴 Rojo: ${detection.redPercentage}%`,
            `   🟡 Amarillo: ${detection.yellowPercentage}%`,
            '',
            `🚩 Bandera Seleccionada: ${alertStatus.level.toUpperCase()}`,
            `📋 Estado: ${alertStatus.label}`,
            `📝 Descripción: ${alertStatus.description}`,
            '',
            '══════════════════════════════════════════════════════════════'
        ];

        return lines.join('\n');
    }
}

