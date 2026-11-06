import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

import { assignRequestLogContext } from '@infrastructure/logging/request-log-context';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      assignRequestLogContext(context.switchToHttp().getResponse(), {
        codeFunctionName: `${context.getClass().name}.${context.getHandler().name}`,
      });
    }

    return next.handle();
  }
}
