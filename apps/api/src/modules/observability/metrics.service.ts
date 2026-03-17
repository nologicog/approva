import { Injectable } from '@nestjs/common';

const METRIC_DEFINITIONS = [
  {
    name: 'authon_approval_requests_created_total',
    description: 'Total approval requests created.',
  },
  {
    name: 'authon_approval_requests_approved_total',
    description: 'Total approval requests approved by a human decision.',
  },
  {
    name: 'authon_approval_requests_denied_total',
    description: 'Total approval requests denied or blocked.',
  },
  {
    name: 'authon_policy_auto_approve_total',
    description: 'Total policy evaluations that auto-approved.',
  },
  {
    name: 'authon_policy_reject_total',
    description: 'Total policy evaluations that rejected.',
  },
  {
    name: 'authon_webhook_deliveries_total',
    description: 'Total successful webhook deliveries.',
  },
  {
    name: 'authon_webhook_failures_total',
    description: 'Total failed webhook deliveries.',
  },
  {
    name: 'authon_email_deliveries_total',
    description: 'Total successful email deliveries.',
  },
  {
    name: 'authon_email_failures_total',
    description: 'Total failed email deliveries.',
  },
] as const;

type MetricName = (typeof METRIC_DEFINITIONS)[number]['name'];

@Injectable()
export class MetricsService {
  private readonly counters = new Map<MetricName, number>(
    METRIC_DEFINITIONS.map((definition) => [definition.name, 0]),
  );

  increment(name: MetricName, value = 1) {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  renderPrometheus() {
    const lines: string[] = [];

    for (const metric of METRIC_DEFINITIONS) {
      lines.push(`# HELP ${metric.name} ${metric.description}`);
      lines.push(`# TYPE ${metric.name} counter`);
      lines.push(`${metric.name} ${this.counters.get(metric.name) ?? 0}`);
    }

    return `${lines.join('\n')}\n`;
  }
}
