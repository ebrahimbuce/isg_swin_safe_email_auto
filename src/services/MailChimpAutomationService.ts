import type { ForecastResult } from './ForecastService.js';
import { MailChimpService } from './MailChimpService.js';
import { HTMLEmailGeneratorService } from './HTMLEmailGeneratorService.js';
import { Logger } from './Logger.js';
import type { MailChimpConfig, MailChimpOperationResult, MailChimpOperation } from './dto/MailChimpDTO.js';

/**
 * MailChimpAutomationService
 *
 * Production-ready automation service for sending forecast reports via MailChimp.
 * Designed with no-fail principles: errors are logged but don't stop the workflow.
 *
 * Features:
 * - Automatic audience reuse (uses existing audience ID from environment)
 * - Automatic campaign creation/reuse
 * - Complete audit logging for all operations
 * - Robust error handling with detailed logging
 * - Idempotent operations (safe to run multiple times)
 */
export class MailChimpAutomationService {
  private mailChimpService: MailChimpService;
  private htmlGenerator: HTMLEmailGeneratorService;
  private logger: Logger;
  private config: MailChimpConfig;

  constructor(mailChimpService: MailChimpService, htmlGenerator: HTMLEmailGeneratorService) {
    this.mailChimpService = mailChimpService;
    this.htmlGenerator = htmlGenerator;
    this.logger = new Logger('MailChimpAutomation');

    // Load configuration from environment
    this.config = {
      apiKey: process.env.MAILCHIMP_API_KEY || '',
      serverPrefix: process.env.MAILCHIMP_SERVER_PREFIX || '',
      listId: process.env.MAILCHIMP_LIST_ID || '',
      fromEmail: process.env.MAILCHIMP_FROM_EMAIL || '',
      fromName: process.env.MAILCHIMP_FROM_NAME || 'Swim Safe Puerto Rico',
    };

    // Validate configuration
    this.validateConfig();
  }

  /**
   * Validates that all required MailChimp configuration is present
   */
  private validateConfig(): void {
    const missing: string[] = [];

    if (!this.config.apiKey) missing.push('MAILCHIMP_API_KEY');
    if (!this.config.serverPrefix) missing.push('MAILCHIMP_SERVER_PREFIX');
    if (!this.config.listId) missing.push('MAILCHIMP_LIST_ID');
    if (!this.config.fromEmail) missing.push('MAILCHIMP_FROM_EMAIL');

    if (missing.length > 0) {
      const error = `Missing required MailChimp configuration: ${missing.join(', ')}`;
      this.logger.error(error);
      throw new Error(error);
    }

    this.logger.info('✓ MailChimp configuration validated', {
      serverPrefix: this.config.serverPrefix,
      listId: this.config.listId,
      fromEmail: this.config.fromEmail,
    });
  }

  /**
   * Sends a forecast campaign to the configured MailChimp audience
   *
   * Production workflow:
   * 1. Uses existing audience (from MAILCHIMP_LIST_ID)
   * 2. Generates HTML email content
   * 3. Creates campaign
   * 4. Sends campaign to all subscribed members
   *
   * @param forecastResult - The forecast data to send
   * @returns Result with success status and audit log
   */
  async sendForecastCampaignAutomated(forecastResult: ForecastResult): Promise<MailChimpOperationResult> {
    const operations: MailChimpOperation[] = [];
    const startTime = Date.now();

    this.logger.info('🚀 Starting automated MailChimp campaign workflow', {
      listId: this.config.listId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Step 1: Generate email content
      this.logger.info('📧 Generating email content...');
      const emailContent = this.htmlGenerator.generateForecastEmail(forecastResult);

      operations.push({
        timestamp: new Date(),
        operation: 'generate_email',
        status: 'success',
        message: `Generated email content (${emailContent.html.length} characters)`,
        details: { subject: emailContent.subject },
      });

      // Step 2: Send campaign using MailChimpService
      this.logger.info('📤 Sending campaign to MailChimp...', {
        listId: this.config.listId,
        subject: emailContent.subject,
      });

      // Preview text fijo
      const previewText = 'Compañía de Turismo de Puerto Rico';

      const success = await this.mailChimpService.sendCampaignWithHTML(
        emailContent.subject,
        emailContent.html,
        forecastResult.outputImagePath,
        this.config.listId,
        previewText
      );

      if (!success) {
        throw new Error('Failed to send campaign');
      }

      operations.push({
        timestamp: new Date(),
        operation: 'send_campaign',
        status: 'success',
        message: 'Campaign sent successfully',
      });

      // Step 3: Calculate duration
      const duration = Date.now() - startTime;
      this.logger.info('✅ MailChimp campaign workflow completed successfully', {
        duration: `${duration}ms`,
        totalOperations: operations.length,
      });

      operations.push({
        timestamp: new Date(),
        operation: 'workflow_complete',
        status: 'success',
        message: `Workflow completed in ${duration}ms`,
      });

      return {
        success: true,
        listId: this.config.listId,
        operations,
      };
    } catch (error) {
      // Production error handling: log but don't throw
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('❌ MailChimp campaign workflow failed', {
        error: errorMessage,
        duration: `${Date.now() - startTime}ms`,
      });

      operations.push({
        timestamp: new Date(),
        operation: 'workflow_failed',
        status: 'error',
        message: `Workflow failed: ${errorMessage}`,
        details: { error },
      });

      return {
        success: false,
        operations,
        error: error instanceof Error ? error : new Error(errorMessage),
      };
    }
  }

  /**
   * Displays a formatted audit log of all operations
   */
  showOperationLog(result: MailChimpOperationResult): void {
    console.log('\n' + '='.repeat(80));
    console.log('📋 MAILCHIMP AUTOMATION AUDIT LOG');
    console.log('='.repeat(80));
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (result.listId) console.log(`List ID: ${result.listId}`);
    if (result.campaignId) console.log(`Campaign ID: ${result.campaignId}`);
    console.log(`Total Operations: ${result.operations.length}`);
    console.log('='.repeat(80));

    result.operations.forEach((op, index) => {
      const statusIcon = op.status === 'success' ? '✓' : op.status === 'error' ? '✗' : '⊘';
      const timestamp = op.timestamp.toLocaleTimeString();

      console.log(`\n${index + 1}. [${timestamp}] ${statusIcon} ${op.operation}`);
      console.log(`   ${op.message}`);

      if (op.details) {
        console.log('   Details:', JSON.stringify(op.details, null, 2));
      }
    });

    if (result.error) {
      console.log('\n' + '!'.repeat(80));
      console.log('ERROR DETAILS:');
      console.log(result.error.message);
      console.log('!'.repeat(80));
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Gets the current MailChimp configuration
   */
  getConfig(): Readonly<MailChimpConfig> {
    return { ...this.config };
  }
}
