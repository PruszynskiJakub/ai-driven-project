import type {Context, Next} from 'hono';

export interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  userAgent?: string;
  ip?: string;
  requestId: string;
  error?: string;
}

export class Logger {
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private getClientIP(c: Context): string {
    const forwarded = c.req.header('x-forwarded-for');
    const realIP = c.req.header('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return 'unknown';
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  public middleware() {
    return async (c: Context, next: Next) => {
      const start = Date.now();
      const requestId = this.generateRequestId();
      const timestamp = isoNow()
      
      c.set('requestId', requestId);

      try {
        await next();
        
        const duration = Date.now() - start;
        const logEntry: LogEntry = {
          timestamp,
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          duration,
          userAgent: c.req.header('user-agent'),
          ip: this.getClientIP(c),
          requestId
        };

        console.log(this.formatLogEntry(logEntry));
        
      } catch (error) {
        const duration = Date.now() - start;
        const logEntry: LogEntry = {
          timestamp,
          method: c.req.method,
          path: c.req.path,
          status: 500,
          duration,
          userAgent: c.req.header('user-agent'),
          ip: this.getClientIP(c),
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        console.error(this.formatLogEntry(logEntry));
        throw error;
      }
    };
  }
}

export const logger = new Logger();
export const loggerMiddleware = logger.middleware();