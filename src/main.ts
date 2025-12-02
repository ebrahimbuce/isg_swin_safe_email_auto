import 'dotenv/config';
import http from 'http';
import { URL } from 'url';
import { ConfigFactory } from './config/ConfigFactory.js';
import { Application } from './services/Application.js';

// Configuración
const PORT = parseInt(process.env.PORT || '3000');
const API_KEY = process.env.API_KEY || 'swim-safe-pr-2024';

let app: Application;
let isProcessing = false;

/**
 * Servidor HTTP para endpoints de cron-job.org
 */
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const path = url.pathname;
    const key = url.searchParams.get('key');

    // Headers CORS
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // ─────────────────────────────────────────────────────────────
    // GET /health - Health check
    // ─────────────────────────────────────────────────────────────
    if (path === '/health' || path === '/') {
        const now = new Date();
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'ok',
            service: 'Swim Safe Puerto Rico',
            timestamp: now.toISOString(),
            timezone: 'America/Puerto_Rico',
            localTime: now.toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' })
        }));
        return;
    }

    // ─────────────────────────────────────────────────────────────
    // GET /send - Disparar envío de email (protegido con API_KEY)
    // ─────────────────────────────────────────────────────────────
    if (path === '/send') {
        // Verificar API key
        if (key !== API_KEY) {
            console.log(`❌ Intento de acceso no autorizado a /send`);
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized', message: 'Invalid API key' }));
            return;
        }

        // Evitar envíos simultáneos
        if (isProcessing) {
            console.log(`⚠️ Envío ya en progreso, ignorando petición`);
            res.writeHead(429);
            res.end(JSON.stringify({ error: 'Too Many Requests', message: 'Send already in progress' }));
            return;
        }

        isProcessing = true;
        const startTime = Date.now();

        try {
            console.log('\n═══════════════════════════════════════════════════════════════');
            console.log('📨 ENVÍO DISPARADO POR CRON-JOB.ORG');
            console.log(`   Hora: ${new Date().toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' })}`);
            console.log('═══════════════════════════════════════════════════════════════\n');

            await app.sendForecastReport(app.getConfig().emailRecipients);

            const duration = Date.now() - startTime;
            console.log(`\n✅ Envío completado en ${duration}ms\n`);

            res.writeHead(200);
            res.end(JSON.stringify({
                status: 'success',
                message: 'Forecast email sent successfully',
                recipients: app.getConfig().emailRecipients,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            }));
        } catch (error: any) {
            console.error('❌ Error en envío:', error);
            res.writeHead(500);
            res.end(JSON.stringify({
                status: 'error',
                message: error.message || 'Failed to send email',
                timestamp: new Date().toISOString()
            }));
        } finally {
            isProcessing = false;
        }
        return;
    }

    // ─────────────────────────────────────────────────────────────
    // 404 - Ruta no encontrada
    // ─────────────────────────────────────────────────────────────
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found', availableEndpoints: ['/health', '/send?key=API_KEY'] }));
});

/**
 * Función principal
 */
async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║       🌊 SWIM SAFE PUERTO RICO - WEB SERVICE                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const config = ConfigFactory.fromEnv();
    app = new Application(config);

    // Manejar señales de cierre graceful
    const shutdown = async (signal: string) => {
        console.log(`\n📴 Recibida señal ${signal}, cerrando...`);
        server.close();
        await app.shutdown();
        console.log('👋 Aplicación cerrada');
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Iniciar aplicación (sin cron jobs internos)
    await app.bootstrapWithoutScheduler();

    // Iniciar servidor HTTP
    server.listen(PORT, () => {
        console.log('\n📋 Configuración:');
        console.table(config.toJSON());

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Servidor HTTP iniciado en puerto ${PORT}`);
        console.log('\n📡 Endpoints disponibles:');
        console.log(`   GET /health     → Health check`);
        console.log(`   GET /send?key=  → Disparar envío de email`);
        console.log('\n🔗 Configurar en cron-job.org:');
        console.log(`   URL: https://tu-app.onrender.com/send?key=${API_KEY}`);
        console.log('   Horarios: 7:02 AM y 12:02 PM (America/Puerto_Rico)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });
}

main().catch((error) => {
    console.error('❌ Error al iniciar:', error);
    process.exit(1);
});
