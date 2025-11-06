/**
 * Vendor App Logger Service
 *
 * Unified logging interface for the vendor app
 * Wraps Sentry with consistent API for error tracking and debugging
 */

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

/**
 * User context interface
 */
export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  displayName?: string;
  tenantId?: string;
  role?: string;
}

/**
 * Breadcrumb interface
 */
export interface Breadcrumb {
  message: string;
  category?: string;
  level?: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
  data?: Record<string, any>;
}

/**
 * Performance span interface
 */
export interface SpanContext {
  operation: string;
  description?: string;
  tags?: Record<string, string>;
}

/**
 * Vendor App Logger
 * Provides unified logging API with Sentry integration
 */
class VendorLogger {
  private initialized = false;

  /**
   * Mark logger as initialized (called after Sentry.init)
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Set user context for error tracking
   */
  setUser(user: UserContext | null): void {
    if (!this.initialized) {
      console.warn('[VendorLogger] Not initialized, skipping setUser');
      return;
    }

    try {
      if (user) {
        Sentry.setUser({
          id: user.id,
          email: user.email,
          username: user.username,
        });

        // Set additional context
        if (user.tenantId) {
          Sentry.setTag('tenantId', user.tenantId);
        }
        if (user.displayName) {
          Sentry.setTag('displayName', user.displayName);
        }
        if (user.role) {
          Sentry.setTag('role', user.role);
        }

        // Always tag as vendor app
        Sentry.setTag('app', 'vendor');
      } else {
        Sentry.setUser(null);
        Sentry.setTag('tenantId', undefined);
        Sentry.setTag('displayName', undefined);
        Sentry.setTag('role', undefined);
      }
    } catch (error) {
      console.error('[VendorLogger] Failed to set user:', error);
    }
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    this.setUser(null);
  }

  /**
   * Log error with Sentry
   */
  error(error: Error | string, context?: Record<string, any>): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;

    if (!this.initialized) {
      return;
    }

    try {
      Sentry.withScope(scope => {
        scope.setTag('platform', Platform.OS);
        scope.setTag('app', 'vendor');
        scope.setTag('level', 'error');
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        Sentry.captureException(errorObj);
      });

      if (__DEV__) {
        console.error(`[VendorLogger] Error captured`, errorObj, context);
      }
    } catch (sentryError) {
      console.error('[VendorLogger] Failed to capture error:', sentryError);
      console.error('[VendorLogger Fallback]', errorObj, context);
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>): void {
    if (!this.initialized) {
      console.info('[VendorLogger Fallback]', message, context);
      return;
    }

    try {
      Sentry.withScope(scope => {
        scope.setTag('platform', Platform.OS);
        scope.setTag('app', 'vendor');
        scope.setTag('level', 'info');
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        Sentry.captureMessage(message, 'info');
      });

      if (__DEV__) {
        console.info(`[VendorLogger] Info captured`, message);
      }
    } catch (error) {
      console.error('[VendorLogger] Failed to capture info:', error);
      console.info('[VendorLogger Fallback]', message, context);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    if (!this.initialized) {
      console.warn('[VendorLogger Fallback]', message, context);
      return;
    }

    try {
      Sentry.withScope(scope => {
        scope.setTag('platform', Platform.OS);
        scope.setTag('app', 'vendor');
        scope.setTag('level', 'warning');
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        Sentry.captureMessage(message, 'warning');
      });

      if (__DEV__) {
        console.warn(`[VendorLogger] Warning captured`, message);
      }
    } catch (error) {
      console.error('[VendorLogger] Failed to capture warning:', error);
      console.warn('[VendorLogger Fallback]', message, context);
    }
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context?: Record<string, any>): void {
    if (__DEV__) {
      console.debug('[VendorLogger Debug]', message, context);
    }

    if (!this.initialized) return;

    try {
      Sentry.withScope(scope => {
        scope.setTag('platform', Platform.OS);
        scope.setTag('app', 'vendor');
        scope.setTag('level', 'debug');
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        Sentry.captureMessage(message);
      });
    } catch (error) {
      console.error('[VendorLogger] Failed to capture debug:', error);
    }
  }

  /**
   * Capture message with custom level
   */
  captureMessage(
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
    context?: Record<string, any>
  ): void {
    if (!this.initialized) {
      console.log(
        `[VendorLogger Fallback ${level.toUpperCase()}]`,
        message,
        context
      );
      return;
    }

    try {
      Sentry.withScope(scope => {
        scope.setTag('platform', Platform.OS);
        scope.setTag('app', 'vendor');
        scope.setTag('level', level);
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        Sentry.captureMessage(message, level);
      });

      if (__DEV__) {
        console.log(`[VendorLogger] Message captured`, message);
      }
    } catch (error) {
      console.error('[VendorLogger] Failed to capture message:', error);
      console.log(
        `[VendorLogger Fallback ${level.toUpperCase()}]`,
        message,
        context
      );
    }
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    if (!this.initialized) {
      console.log('[VendorLogger Breadcrumb]', breadcrumb);
      return;
    }

    try {
      Sentry.addBreadcrumb({
        message: breadcrumb.message,
        category: breadcrumb.category || 'vendor',
        level: breadcrumb.level || 'info',
        data: breadcrumb.data,
        timestamp: Date.now() / 1000,
      });
    } catch (error) {
      console.error('[VendorLogger] Failed to add breadcrumb:', error);
      console.log('[VendorLogger Breadcrumb]', breadcrumb);
    }
  }

  /**
   * Set custom tag
   */
  setTag(key: string, value: string): void {
    if (!this.initialized) return;

    try {
      Sentry.setTag(key, value);
    } catch (error) {
      console.error('[VendorLogger] Failed to set tag:', error);
    }
  }

  /**
   * Set extra data
   */
  setExtra(key: string, value: any): void {
    if (!this.initialized) return;

    try {
      Sentry.setExtra(key, value);
    } catch (error) {
      console.error('[VendorLogger] Failed to set extra:', error);
    }
  }

  /**
   * Start performance span
   */
  startSpan(context: SpanContext): { finish: (result?: any) => void } {
    if (!this.initialized) {
      const startTime = Date.now();
      return {
        finish: (result?: any) => {
          const duration = Date.now() - startTime;
          console.log(
            `[VendorLogger Span] ${context.operation}: ${duration}ms`,
            result
          );
        },
      };
    }

    try {
      // For performance tracking, use breadcrumbs and manual timing
      const startTime = Date.now();

      // Add start breadcrumb
      Sentry.addBreadcrumb({
        message: `Started: ${context.operation}`,
        category: 'performance',
        level: 'info',
        data: context.tags,
      });

      return {
        finish: (result?: any) => {
          try {
            const duration = Date.now() - startTime;

            // Add finish breadcrumb with timing
            Sentry.addBreadcrumb({
              message: `Finished: ${context.operation}`,
              category: 'performance',
              level: 'info',
              data: {
                ...context.tags,
                duration: `${duration}ms`,
                result: result ? 'success' : 'completed',
              },
            });

            if (__DEV__) {
              console.log(
                `[VendorLogger Span] ${context.operation}: ${duration}ms`,
                result
              );
            }
          } catch (error) {
            console.error('[VendorLogger] Failed to finish span:', error);
          }
        },
      };
    } catch (error) {
      console.error('[VendorLogger] Failed to start span:', error);
      const startTime = Date.now();
      return {
        finish: (result?: any) => {
          const duration = Date.now() - startTime;
          console.log(
            `[VendorLogger Span] ${context.operation}: ${duration}ms`,
            result
          );
        },
      };
    }
  }

  /**
   * Check if logger is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const logger = new VendorLogger();

// Export convenience functions for direct use
export const setUser = (user: UserContext | null) => logger.setUser(user);
export const clearUser = () => logger.clearUser();
export const addBreadcrumb = (breadcrumb: Breadcrumb) =>
  logger.addBreadcrumb(breadcrumb);
export const setTag = (key: string, value: string) => logger.setTag(key, value);
export const setExtra = (key: string, value: any) =>
  logger.setExtra(key, value);
export const startSpan = (context: SpanContext) => logger.startSpan(context);
