import 'dotenv/config';
import { Logger } from '../services/Logger.js';
import { ImageProcessorService } from '../services/ImageProcessorService.js';
import { ForecastService } from '../services/ForecastService.js';
import { EmailService } from '../services/EmailService.js';
import { HTMLEmailGeneratorService } from '../services/HTMLEmailGeneratorService.js';

async function testEmail() {
  const logger = new Logger('debug');

  console.log('\n=== TEST DE ENVÍO DE EMAIL ===\n');

  // Verificar variables de entorno
  console.log('📧 Verificando configuración:');
  console.log(`   GMAIL_USER: ${process.env.GMAIL_USER || '❌ NO CONFIGURADO'}`);
  console.log(`   GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD ? '✅ Configurado' : '❌ NO CONFIGURADO'}`);
  console.log(`   EMAIL_RECIPIENTS: ${process.env.EMAIL_RECIPIENTS || '❌ NO CONFIGURADO'}`);

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('\n❌ Error: Configura GMAIL_USER y GMAIL_APP_PASSWORD en el archivo .env');
    process.exit(1);
  }

  // Usar argumento de línea de comandos o variable de entorno
  // Buscar un argumento que parezca email (contiene @)
  const emailArg = process.argv.find((arg) => arg.includes('@'));
  const recipients = emailArg ? [emailArg] : process.env.EMAIL_RECIPIENTS?.split(',').map((e) => e.trim()) || [];

  if (recipients.length === 0) {
    console.error('\n❌ Error: Pasa un email como argumento o configura EMAIL_RECIPIENTS en .env');
    console.error('   Uso: npm run test:email tu-email@gmail.com');
    process.exit(1);
  }

  console.log(`\n📬 Destinatarios: ${recipients.join(', ')}`);

  try {
    // Crear servicios
    const imageProcessor = new ImageProcessorService(logger);
    const forecastService = new ForecastService(logger, imageProcessor);
    const htmlEmailGenerator = new HTMLEmailGeneratorService(logger);
    const emailService = new EmailService(logger, forecastService, htmlEmailGenerator, imageProcessor);

    console.log('\n🚀 Enviando email de prueba...\n');

    // Enviar reporte
    const result = await emailService.sendForecastReport({ to: recipients });

    if (result) {
      console.log('\n✅ ¡Email enviado exitosamente!');
    }
  } catch (error) {
    console.error('\n❌ Error al enviar email:', error);
    process.exit(1);
  }
}

testEmail();
