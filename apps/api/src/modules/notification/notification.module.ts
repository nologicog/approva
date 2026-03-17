import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SlackModule } from '../slack/slack.module';
import { WebhookModule } from '../webhook/webhook.module';
import { NotificationService } from './notification.service';

@Module({
  imports: [EmailModule, SlackModule, WebhookModule, IntegrationsModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
