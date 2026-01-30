import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from "rxjs";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === "object" && "data" in (data as object)) {
          return data;
        }

        return {
          data,
          meta: { timestamp: new Date().toISOString() },
        };
      }),
    );
  }
}
