export interface MailChimpConfig {
  apiKey: string;
  serverPrefix: string;
  listId: string;
  fromEmail: string;
  fromName: string;
}

export interface MailChimpCampaignParams {
  listId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  campaignName: string;
  htmlContent: string;
}

export interface MailChimpListParams {
  name: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  permission_reminder: string;
  company: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface MailChimpMemberParams {
  email_address: string;
  status: 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending';
  merge_fields?: {
    FNAME?: string;
    LNAME?: string;
    [key: string]: any;
  };
}

export interface MailChimpOperation {
  timestamp: Date;
  operation: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
  details?: any;
}

export interface MailChimpOperationResult {
  success: boolean;
  listId?: string;
  campaignId?: string;
  operations: MailChimpOperation[];
  error?: Error;
}
