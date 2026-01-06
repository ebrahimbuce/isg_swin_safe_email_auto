import { ForecastService } from '../services/ForecastService.js';
import { Logger } from '../services/Logger.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { HTMLGeneratorService } from '../services/HTMLGeneratorService.js';
import path from 'path';
import fs from 'fs';

async function runRealTest() {
  console.log('=============================================');
  console.log('🌎 TEST DE DATOS REALES (NOAA FORECAST)');
  console.log('=============================================');

  const logger = new Logger('debug');
  const imageProcessor = new ImageProcessorService(logger);
  const service = new ForecastService(logger, imageProcessor);

  console.log('\n📡 Descargando imagen real desde weather.gov...');
  const start = performance.now();

  // Forzamos una ejecución real llamando al método público checkCurrentStatus
  // Como es una nueva instancia, el caché está vacío y DEBE descargar.
  try {
    const status = await service.checkCurrentStatus();
    const end = performance.now();

    console.log(`\n✅ Proceso completado en ${(end - start).toFixed(2)}ms`);
    console.log('\n📊 RESULTADO DEL ANÁLISIS EN TIEMPO REAL:');
    console.log('---------------------------------------------');

    const level = (status as any).level || (status as any).levelName;
    const rawDescription = (status as any).description || '';

    // Traducciones Nivel
    const traduccionesNivel: Record<string, string> = {
      green: '🟢 VERDE (Bajo)',
      yellow: '🟡 AMARILLO (Moderado)',
      red: '🔴 ROJO (Alto)',
      low: '🟢 VERDE (Bajo)',
      moderate: '🟡 AMARILLO (Moderado)',
      high: '🔴 ROJO (Alto)',
    };

    const nivelEs = traduccionesNivel[level] || level;

    // Usamos label_es si existe (nuevo implementación), o fallback a label original traducido
    let labelEs = (status as any).label_es;
    if (!labelEs) {
      const rawLabel = (status as any).label || '';
      const traduccionesLabel: Record<string, string> = {
        'STRONG CURRENTS': 'Corrientes Fuertes',
        'MODERATE CURRENTS': 'Corrientes Moderadas',
        'CALM CONDITIONS': 'Condiciones Calmas',
        'strong current': 'Corriente Fuerte',
        'moderate current': 'Corriente Moderada',
        'calm current': 'Corriente Calma',
      };
      labelEs = traduccionesLabel[rawLabel] || traduccionesLabel[rawLabel.toLowerCase()] || rawLabel;
    }

    // Traducción básica de descripción
    let descEs = rawDescription;
    if (rawDescription.includes('No significant weather')) {
      descEs = 'No se espera clima significativo que afecte las operaciones.';
    } else if (rawDescription.includes('Thunderstorms')) {
      descEs = 'Tormentas eléctricas detectadas en el área.';
    }

    console.log(`Nivel de Alerta: ${nivelEs}`);
    console.log(`Etiqueta:        ${labelEs}`);
    console.log(`Descripción:     "${descEs}"`);

    // Si el usuario dice que el clima cambió, aquí debería reflejarse.
    if ((status as any).level === 'green' || (status as any).levelName === 'low') {
      console.log('\n🟢 El sistema detecta condiciones CALMAS (Verde).');
    } else {
      console.log('\n⚠️ El sistema detecta condiciones de RIESGO.');
    }

    console.log('\nNOTA: Si este resultado coincide con el mapa real de NOAA,');
    console.log('      entonces el sistema está funcionando correctamente.');
    console.log('      (El caché se limpia al reiniciar el proceso o tras 15 min).');
  } catch (err) {
    console.error('❌ Error obteniendo datos reales:', err);
  }
}

runRealTest();
