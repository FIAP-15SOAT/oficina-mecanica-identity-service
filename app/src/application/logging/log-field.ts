export type LogicalFieldName =
  | 'subjectId'
  | 'subjectName'
  | 'subjectEmail'
  | 'failureReason'
  | 'targetUserId'
  | 'targetUserActive'
  | 'resetOutcome'
  | 'workOrderId'
  | 'port'
  | 'signal'
  | 'dependencyName'
  | 'healthFailureCategory'
  | 'healthDegradedDurationMs';

export type LogFields = Partial<Record<LogicalFieldName, unknown>>;
