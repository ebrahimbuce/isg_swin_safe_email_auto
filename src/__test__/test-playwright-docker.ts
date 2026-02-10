import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testPlaywright() {
  console.log('🧪 Iniciando prueba de diagnóstico de Playwright...');

  let browser: Browser | null = null;

  try {
    console.log('1. Verificando entorno...');
    console.log(`   OS: ${process.platform}`);
    console.log(`   Node: ${process.version}`);

    console.log('2. Iniciando Chromium...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Vital para Docker
        '--disable-gpu',
      ],
    });

    const version = browser.version();
    console.log(`   ✅ Chromium iniciado correctamente. Versión: ${version}`);

    console.log('3. Creando contexto y página...');
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('4. Probando renderizado básico (About:blank)...');
    await page.goto('about:blank');

    // Prueba de generación de screenshot
    console.log('5. Probando captura de pantalla...');
    // Crear un HTML simple temporal para renderizar
    const testHtmlPath = path.join(__dirname, '../../public/test-playwright.html');
    const testHtmlContent = `
            <html>
                <body style="background-color: #05998c; color: white; display: flex; justify-content: center; align-items: center; height: 100vh;">
                    <h1>Playwright Test OK</h1>
                    <p>${new Date().toISOString()}</p>
                </body>
            </html>
        `;

    fs.writeFileSync(testHtmlPath, testHtmlContent);
    console.log(`   Archivo HTML de prueba creado en: ${testHtmlPath}`);

    await page.goto(`file://${testHtmlPath}`);

    // Screenshot
    const screenshotPath = path.join(__dirname, '../../public/final/test-playwright-output.png');

    // Asegurar que directorio existe
    const finalDir = path.dirname(screenshotPath);
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    await page.screenshot({ path: screenshotPath });
    console.log(`   ✅ Screenshot guardado en: ${screenshotPath}`);

    // Limpieza de prueba
    fs.unlinkSync(testHtmlPath);

    console.log('\n✨ DIAGNÓSTICO EXITOSO: Playwright funciona correctamente en este entorno.');
  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO: Playwright falló.');
    console.error(error);
    process.exit(1);
  } finally {
    if (browser) {
      console.log('6. Cerrando navegador...');
      await browser.close();
    }
  }
}

testPlaywright();
