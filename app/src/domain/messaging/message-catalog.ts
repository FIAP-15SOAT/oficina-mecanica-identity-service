import { NotificationMessagePayloads } from './notification.messages';

export type MessagePayloads = NotificationMessagePayloads;

export type MessageType = keyof MessagePayloads;

export type OutboxMessage = {
  [T in MessageType]: { type: T; workOrderId: string | null; payload: MessagePayloads[T] };
}[MessageType];
