/**
 * Startup Health Checks
 * Validates critical dependencies are available before starting server
 */

import { PrismaClient } from '@prisma/client';

export interface StartupCheckResult {
  success: boolean;
  checks: {
    name: string;
    passed: boolean;
    error?: string;
    duration?: number;
  }[];
}

/**
 * Run all startup checks
 */
export async function runStartupChecks(prisma: PrismaClient): Promise<StartupCheckResult> {
  const checks: StartupCheckResult['checks'] = [];
  
  console.log('🔍 Running startup health checks...\n');

  // Check 1: Database connectivity
  const dbCheck = await checkDatabaseConnectivity(prisma);
  checks.push(dbCheck);
  logCheck(dbCheck);

  // Check 2: Database schema
  const schemaCheck = await checkDatabaseSchema(prisma);
  checks.push(schemaCheck);
  logCheck(schemaCheck);

  // Check 3: Payment provider reachability (non-blocking)
  const paymentCheck = await checkPaymentProvider();
  checks.push(paymentCheck);
  logCheck(paymentCheck);

  // Check 4: Redis connectivity (optional)
  const redisCheck = await checkRedisConnectivity();
  checks.push(redisCheck);
  logCheck(redisCheck);

  console.log('');

  const allPassed = checks.every(c => c.passed);
  const criticalFailed = checks.filter(c => !c.passed && c.name.includes('[CRITICAL]')).length > 0;

  return {
    success: allPassed || !criticalFailed,
    checks,
  };
}

/**
 * Check database connectivity
 */
async function checkDatabaseConnectivity(prisma: PrismaClient) {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: '[CRITICAL] Database Connectivity',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: '[CRITICAL] Database Connectivity',
      passed: false,
      error: error.message,
      duration: Date.now() - start,
    };
  }
}

/**
 * Check database schema is up to date
 */
async function checkDatabaseSchema(prisma: PrismaClient) {
  const start = Date.now();
  try {
    // Try to query core tables
    await prisma.user.count();
    await prisma.nip05.count();
    await prisma.subscription.count();
    
    return {
      name: '[CRITICAL] Database Schema',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: '[CRITICAL] Database Schema',
      passed: false,
      error: `Schema check failed: ${error.message}. Run 'npx prisma migrate deploy'`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Check payment provider is reachable
 */
async function checkPaymentProvider() {
  const start = Date.now();
  const provider = process.env.PAYMENTS_PROVIDER || 'btcpay';
  
  try {
    if (provider === 'btcpay') {
      const btcpayUrl = process.env.BTCPAY_URL;
      if (!btcpayUrl || btcpayUrl.includes('example.com')) {
        return {
          name: '[WARN] Payment Provider',
          passed: true, // Don't block startup
          error: 'BTCPay URL not configured or using placeholder',
          duration: Date.now() - start,
        };
      }
      
      // Try to fetch BTCPay server info
      const response = await fetch(`${btcpayUrl}/api/v1/server/info`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5s timeout
      });
      
      if (response.ok) {
        return {
          name: '[WARN] Payment Provider',
          passed: true,
          duration: Date.now() - start,
        };
      } else {
        return {
          name: '[WARN] Payment Provider',
          passed: true, // Don't block startup
          error: `BTCPay server returned ${response.status} (may need API key)`,
          duration: Date.now() - start,
        };
      }
    } else if (provider === 'lnbits') {
      const lnbitsUrl = process.env.LNBITS_URL;
      if (!lnbitsUrl) {
        return {
          name: '[WARN] Payment Provider',
          passed: true,
          error: 'LNbits URL not configured',
          duration: Date.now() - start,
        };
      }
      
      // Try to fetch LNbits API
      const response = await fetch(`${lnbitsUrl}/api/v1/wallet`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Api-Key': process.env.LNBITS_API_KEY || '',
        },
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        return {
          name: '[WARN] Payment Provider',
          passed: true,
          duration: Date.now() - start,
        };
      } else {
        return {
          name: '[WARN] Payment Provider',
          passed: true,
          error: `LNbits returned ${response.status}`,
          duration: Date.now() - start,
        };
      }
    }
    
    return {
      name: '[WARN] Payment Provider',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: '[WARN] Payment Provider',
      passed: true, // Don't block startup
      error: `Could not reach payment provider: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Check Redis connectivity (optional)
 */
async function checkRedisConnectivity(): Promise<{
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}> {
  const start = Date.now();
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;
  
  if (!redisHost || !redisPort) {
    return {
      name: '[INFO] Redis Connectivity',
      passed: true,
      error: 'Redis not configured (using in-memory cache)',
      duration: Date.now() - start,
    };
  }
  
  try {
    // Try to connect to Redis using native TCP
    const net = await import('net');
    
    return await new Promise<{
      name: string;
      passed: boolean;
      error?: string;
      duration?: number;
    }>((resolve) => {
      const socket = net.createConnection({
        host: redisHost,
        port: parseInt(redisPort),
        timeout: 3000,
      });
      
      socket.on('connect', () => {
        socket.end();
        resolve({
          name: '[INFO] Redis Connectivity',
          passed: true,
          duration: Date.now() - start,
        });
      });
      
      socket.on('error', (error: Error) => {
        resolve({
          name: '[INFO] Redis Connectivity',
          passed: true, // Don't block startup
          error: `Redis not reachable: ${error.message}`,
          duration: Date.now() - start,
        });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          name: '[INFO] Redis Connectivity',
          passed: true,
          error: 'Redis connection timeout',
          duration: Date.now() - start,
        });
      });
    });
  } catch (error) {
    return {
      name: '[INFO] Redis Connectivity',
      passed: true,
      error: `Redis check failed: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Log check result
 */
function logCheck(check: StartupCheckResult['checks'][0]) {
  const status = check.passed ? '✓' : '✗';
  const duration = check.duration ? ` (${check.duration}ms)` : '';
  
  if (check.passed) {
    console.log(`  ${status} ${check.name}${duration}`);
  } else {
    console.error(`  ${status} ${check.name}${duration}`);
    if (check.error) {
      console.error(`    Error: ${check.error}`);
    }
  }
}

/**
 * Format startup check results for logging
 */
export function formatStartupCheckResults(result: StartupCheckResult): string {
  const lines: string[] = [];
  
  if (result.success) {
    lines.push('✓ All critical startup checks passed');
  } else {
    lines.push('✗ Startup checks failed');
  }
  
  const failed = result.checks.filter(c => !c.passed);
  if (failed.length > 0) {
    lines.push('');
    lines.push('Failed checks:');
    failed.forEach(check => {
      lines.push(`  - ${check.name}: ${check.error}`);
    });
  }
  
  return lines.join('\n');
}
