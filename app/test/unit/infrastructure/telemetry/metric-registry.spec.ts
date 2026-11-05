import { AggregationType } from '@opentelemetry/sdk-metrics';

import { BusinessMetricDefinition, BusinessMetricName } from '@application/metrics/business-metric';
import { BUSINESS_METRICS } from '@application/metrics/business-metric.catalog';
import { MetricAttributeName } from '@application/metrics/metric-attribute';
import {
  buildMetricViews,
  METRIC_ATTRIBUTE_REGISTRY,
  MetricAttributeRegistryEntry,
  METRIC_REGISTRY,
  MetricCardinality,
  MetricRegistryEntry,
  resolveMetricAttribute,
  resolveMetricKey,
} from '@infrastructure/telemetry/metric-registry';

type AttributesOf<TDefinition> =
  TDefinition extends BusinessMetricDefinition<infer TAttributes> ? keyof TAttributes : never;

type CatalogAttributeName = AttributesOf<(typeof BUSINESS_METRICS)[keyof typeof BUSINESS_METRICS]>;

type CatalogMetricName = (typeof BUSINESS_METRICS)[keyof typeof BUSINESS_METRICS]['name'];

type Assert<T extends true> = T;

type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * Compile failure in both directions: a metric declared in the vocabulary that
 * no catalog entry emits (a dead entry), or a catalog metric without a registry
 * entry (a physical name that does not exist at runtime). The registry's
 * `Record<BusinessMetricName, ...>` closes the second direction; this assertion
 * closes the first.
 */
type _CatalogMatchesVocabulary = Assert<MutuallyAssignable<CatalogMetricName, BusinessMetricName>>;

/**
 * Every attribute the catalog declares must exist in the logical vocabulary —
 * otherwise the adapter would drop it at runtime, and the metric would go out
 * without the dimension the dashboard expects.
 */
type _AttributesBelongToVocabulary = Assert<
  [CatalogAttributeName] extends [MetricAttributeName] ? true : false
>;

/**
 * `high` does not belong to the type: declaring high cardinality on a metric
 * attribute is a **compile error**, not a forgotten review. It is what stops a
 * work order, customer or user identifier from becoming a dimension and
 * multiplying series without bound.
 */
type _NoHighCardinalityAttribute = Assert<'high' extends MetricCardinality ? false : true>;

describe('metric registry', () => {
  it('should declare a physical name for every metric in the catalog', () => {
    for (const definition of Object.values<BusinessMetricDefinition>(BUSINESS_METRICS)) {
      expect(resolveMetricKey(definition.name)).toBeDefined();
    }
  });

  it('should keep physical names inside the application owned namespace', () => {
    for (const entry of Object.values<MetricRegistryEntry>(METRIC_REGISTRY)) {
      expect(entry.key.startsWith('oficina.')).toBe(true);
    }
  });

  /**
   * The convention does not define these attributes, and extending one of its
   * namespaces is forbidden: `oficina.work_order.status`, never
   * `work_order.status`.
   */
  it('should keep attribute names inside the owned namespace', () => {
    for (const entry of Object.values<MetricAttributeRegistryEntry>(METRIC_ATTRIBUTE_REGISTRY)) {
      expect(entry.key.startsWith('oficina.')).toBe(true);
    }
  });

  it('should derive a view only for entries that declare a custom aggregation', () => {
    const views = buildMetricViews({
      'test.created': {
        key: 'oficina.test.created',
        aggregation: { type: AggregationType.DEFAULT },
      },
      'test.duration': {
        key: 'oficina.test.duration',
        aggregation: { type: AggregationType.EXPONENTIAL_HISTOGRAM },
      },
    });

    expect(views).toEqual([
      {
        instrumentName: 'oficina.test.duration',
        aggregation: { type: AggregationType.EXPONENTIAL_HISTOGRAM },
      },
    ]);
  });

  it('should resolve the physical name of a registered metric', () => {
    const registry = METRIC_REGISTRY as Record<string, MetricRegistryEntry>;
    registry['test.created'] = {
      key: 'oficina.test.created',
      aggregation: { type: AggregationType.DEFAULT },
    };

    try {
      expect(resolveMetricKey('test.created' as never)).toBe('oficina.test.created');
    } finally {
      delete registry['test.created'];
    }
  });

  /**
   * An entity identifier as an attribute multiplies time series without bound,
   * at a cost proportional to traffic.
   */
  it('should not declare any entity identifier as an attribute', () => {
    const forbidden = ['id', 'customer', 'user', 'vehicle', 'number'];

    for (const name of Object.keys(METRIC_ATTRIBUTE_REGISTRY)) {
      for (const token of forbidden) {
        expect(name.toLowerCase()).not.toContain(token);
      }
    }
  });

  it('should return undefined for an attribute outside the logical vocabulary', () => {
    expect(resolveMetricAttribute('workOrderId')).toBeUndefined();
  });
});
