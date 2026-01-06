import { ForecastService } from '../services/ForecastService.js';
import { Logger } from '../services/Logger.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';

// Mock Logger básico para ver output en consola
const mockLogger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
} as unknown as Logger;

// Mock ImageProcessor para no hacer procesamiento pesado real ni descargas
const mockImageProcessor = {
  getImage: async () => Buffer.from('fake-image-data'), // Simulamos descarga rápida
  cropImage: async () => Buffer.from('fake-cropped-data'),
  detectColors: async () => ({
    hasRed: true,
    redPercentage: 15.5, // 15% de rojo (Suficiente para alerta ROJA)
    hasYellow: false,
    yellowPercentage: 0,
  }),
} as unknown as ImageProcessorService;

// Extendemos la clase para poder interceptar métodos privados y verificar llamadas
class TestableForecastService extends ForecastService {
  public getImageCallCount: number = 0;

  // Método mock para simular la descarga de imagen y contar llamadas
  public async getImageMock(): Promise<Buffer> {
    this.getImageCallCount++;
    console.log('      (Mock) Descargando imagen...');
    return Buffer.from('fake-downloaded-image');
  }

  // Helper para manipular la propiedad privada lastStatusCheck
  public expireCache() {
    console.log('      (Test) Forzando expiración de caché...');
    (this as any).lastStatusCheck = 0;
  }
}

async function runTest() {
  console.log('=============================================');
  console.log('🧪 TEST DE EFICIENCIA DE CACHÉ (FORECAST)');
  console.log('=============================================\n');

  const service = new TestableForecastService(mockLogger, mockImageProcessor);
    // Reemplaza el método privado getImage por el mock público getImageMock
    (service as any).getImage = service.getImageMock.bind(service);

  // --- ESCENARIO 1: Primera llamada (Caché frío) ---
  console.log('📝 ESCENARIO 1: Primera llamada (Sin caché)');
  console.log('   Esperado: Debe descargar la imagen.');

  const start1 = performance.now();
  const status1 = await service.checkCurrentStatus();
  const end1 = performance.now();

  if (service.getImageCallCount === 1) {
    console.log(`   ✅ PASS: Se descargó la imagen. Tiempo: ${(end1 - start1).toFixed(2)}ms`);
    // Verificamos que sea ROJO gracias al mock actualizado
    if ((status1 as any).level === 'red') {
      console.log(`   ✅ PASS: Estado detectado correctamente (ROJO)`);
    } else {
      console.error(`   ❌ FAIL: Estado incorrecto. Esperado 'red', recibido: ${(status1 as any).level}`);
      process.exit(1);
    }
  } else {
    console.error(`   ❌ FAIL: No se descargó la imagen. Contador: ${service.getImageCallCount}`);
    process.exit(1);
  }

  // --- ESCENARIO 2: Segunda llamada inmediata (Caché caliente) ---
  console.log('\n📝 ESCENARIO 2: Segunda llamada inmediata (Con caché)');
  console.log('   Esperado: NO debe descargar imagen (0ms latencia) y mantener estado ROJO.');

  const start2 = performance.now();
  const status2 = await service.checkCurrentStatus();
  const end2 = performance.now();

  if (service.getImageCallCount === 1) {
    console.log(`   ✅ PASS: Contador de descargas se mantuvo en 1.`);
    console.log(`   🚀 TIEMPO DE RESPUESTA: ${(end2 - start2).toFixed(4)}ms (Extremadamente rápido)`);

    if (status1 === status2) {
      // Verificar identidad referencial
      console.log(`   ✅ PASS: El objeto retornado es IDENTICO (Referencia de Memoria)`);
    } else {
      console.warn(`   ⚠️ WARN: El objeto es diferente, posible copia innecesaria.`);
    }
  } else {
    console.error(`   ❌ FAIL: Se descargó la imagen de nuevo. Contador: ${service.getImageCallCount}`);
    process.exit(1);
  }

  // --- ESCENARIO 3: Caché Expirado ---
  console.log('\n📝 ESCENARIO 3: Caché Expirado (Simulado)');
  console.log('   Esperado: Debe volver a descargar la imagen.');

  service.expireCache();

  const start3 = performance.now();
  await service.checkCurrentStatus();
  const end3 = performance.now();

  if (service.getImageCallCount === Number(2)) {
    console.log(`   ✅ PASS: Se descargó la imagen nuevamente.`);
  } else {
    console.error(`   ❌ FAIL: No se actualizó tras expirar. Contador: ${service.getImageCallCount}`);
    process.exit(1);
  }

  console.log('\n=============================================');
  console.log('🎉  TODOS LOS TESTS DE EFICIENCIA PASARON');
  console.log('=============================================');
}

runTest().catch(console.error);
