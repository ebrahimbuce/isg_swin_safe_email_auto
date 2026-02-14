import 'dotenv/config';
/**
 * Lista las campañas de MailChimp para obtener el ID de la campaña a replicar.
 * Ejecutar: pnpm run test:mailchimp:list
 *
 * Usa el campo "id" de la campaña que quieras como MAILCHIMP_TEMPLATE_CAMPAIGN_ID en .env
 */

import { Logger } from '../services/Logger.js';
import { MailChimpService } from '../services/MailChimpService.js';

async function main() {
  const logger = new Logger('MailChimpListCampaigns');

  try {
    const mailChimpService = new MailChimpService(logger);
    await mailChimpService.initialize();

    const response = await mailChimpService.getCampaigns(50);
    const campaigns = response.campaigns || [];

    console.log('\n📋 Campañas en tu cuenta MailChimp:\n');
    console.log('   Usa el "id" como MAILCHIMP_TEMPLATE_CAMPAIGN_ID en .env para replicar campaña\n');

    campaigns.slice(0, 20).forEach((c: any) => {
      const status = c.status || 'unknown';
      const sentAt = c.send_time ? new Date(c.send_time).toLocaleString() : '-';
      console.log(`   📧 ${c.settings?.subject_line || c.title || 'Sin asunto'}`);
      console.log(`      id: ${c.id}`);
      console.log(`      Estado: ${status} | Enviada: ${sentAt}\n`);
    });

    if (campaigns.length === 0) {
      console.log('   No hay campañas en esta cuenta.\n');
    }

    await mailChimpService.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
