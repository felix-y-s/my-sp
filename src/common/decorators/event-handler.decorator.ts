import { SetMetadata } from '@nestjs/common';
import { EventType } from '../events/event-types.enum';

/**
 * 이벤트 핸들러를 표시하는 데코레이터
 * Saga Choreography 패턴에서 각 서비스의 이벤트 리스너를 등록할 때 사용
 */
export const EVENT_HANDLER_METADATA = 'EVENT_HANDLER_METADATA';

export const EventHandler = (eventType: EventType) => {
  return SetMetadata(EVENT_HANDLER_METADATA, eventType);
};
