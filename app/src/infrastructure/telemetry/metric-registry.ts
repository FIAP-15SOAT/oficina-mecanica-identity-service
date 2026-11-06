import { AggregationOption, AggregationType, ViewOptions } from '@opentelemetry/sdk-metrics';

import { BusinessMetricName } from '@application/metrics/business-metric';
import { MetricAttributeName } from '@application/metrics/metric-attribute';

export type MetricCardinality = 'fixed' | 'low';

export interface MetricRegistryEntry {
  /** Physical name. Only here — nowhere else — does the `oficina.` namespace appear. */
  key: string;
  aggregation: AggregationOption;
}

export interface MetricAttributeRegistryEntry {
  key: string;
  cardinality: MetricCardinality;
}

export const METRIC_REGISTRY: Readonly<Record<BusinessMetricName, MetricRegistryEntry>> = {};

export const METRIC_ATTRIBUTE_REGISTRY: Readonly<
  Record<MetricAttributeName, MetricAttributeRegistryEntry>
> = {};

/**
 * Entries with the default aggregation produce no View — a "default" View would
 * be noise with no effect.
 */
export function buildMetricViews(
  registry: Readonly<Record<string, MetricRegistryEntry>>,
): readonly ViewOptions[] {
  return Object.values(registry)
    .filter((entry) => entry.aggregation.type !== AggregationType.DEFAULT)
    .map((entry) => ({ instrumentName: entry.key, aggregation: entry.aggregation }));
}

export const METRIC_VIEWS: readonly ViewOptions[] = buildMetricViews(METRIC_REGISTRY);

export function resolveMetricKey<TName extends BusinessMetricName>(name: TName): string {
  const entry: MetricRegistryEntry = METRIC_REGISTRY[name];
  return entry.key;
}

export function resolveMetricAttribute(name: string): MetricAttributeRegistryEntry | undefined {
  return METRIC_ATTRIBUTE_REGISTRY[name as MetricAttributeName];
}
