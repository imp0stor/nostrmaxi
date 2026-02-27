/**
 * Configuration Validation Module
 * Validates all required environment variables at startup
 * Fails fast with clear error messages if configuration is invalid
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigValidationOptions {
  strict?: boolean; // If true, warnings treated as errors
  skipPaymentValidation?: boolean; // For testing without payment provider
}

/**
 * Validate required environment variables
 */
export function validateConfiguration(options: ConfigValidationOptions = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const { strict = false, skipPaymentValidation = false } = options;

  // ============================================================================
  // CRITICAL ENVIRONMENT VARIABLES
  // ============================================================================
  
  // JWT Secret
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (jwtSecret.includes('change-in-production') || jwtSecret.includes('your-')) {
    errors.push('JWT_SECRET is using placeholder/example value - must be changed for production');
  } else if (jwtSecret.length < 32) {
    warnings.push(`JWT_SECRET is too short (${jwtSecret.length} chars, recommend 64+)`);
  }

  // Database URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required');
  } else {
    // Check for default/insecure credentials
    if (databaseUrl.includes('postgres:postgres@')) {
      warnings.push('DATABASE_URL using default postgres:postgres credentials');
    }
    
    // Validate PostgreSQL URL format
    if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
      errors.push('DATABASE_URL must start with postgresql:// or postgres://');
    }
  }

  // Domain configuration
  const domain = process.env.DOMAIN || process.env.NIP05_DEFAULT_DOMAIN;
  if (!domain) {
    errors.push('DOMAIN or NIP05_DEFAULT_DOMAIN is required');
  } else if (domain === 'nostrmaxi.com' || domain === 'example.com') {
    warnings.push(`DOMAIN is using example value: ${domain}`);
  }

  // Base URL
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    errors.push('BASE_URL is required');
  } else {
    if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      errors.push('BASE_URL contains localhost in production mode');
    }
    
    if (process.env.NODE_ENV === 'production' && !baseUrl.startsWith('https://')) {
      errors.push('BASE_URL must use https:// in production mode');
    }
  }

  // Admin pubkeys
  const adminPubkeys = process.env.ADMIN_PUBKEYS;
  if (!adminPubkeys) {
    errors.push('ADMIN_PUBKEYS is required - no admin access configured!');
  } else {
    // Validate hex format
    const pubkeys = adminPubkeys.split(',').map(pk => pk.trim());
    pubkeys.forEach((pubkey, idx) => {
      if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
        errors.push(`ADMIN_PUBKEYS[${idx}] is not a valid 64-character hex pubkey: ${pubkey.substring(0, 16)}...`);
      }
    });
  }

  // CORS Origins
  const corsOrigins = process.env.CORS_ORIGINS;
  if (!corsOrigins) {
    errors.push('CORS_ORIGINS is required');
  } else if (corsOrigins === '*') {
    errors.push('CORS_ORIGINS cannot be wildcard (*) - security risk');
  } else if (corsOrigins.includes('localhost') && process.env.NODE_ENV === 'production') {
    errors.push('CORS_ORIGINS contains localhost in production mode');
  }

  // ============================================================================
  // PAYMENT PROVIDER CONFIGURATION
  // ============================================================================
  
  if (!skipPaymentValidation) {
    const paymentsProvider = process.env.PAYMENTS_PROVIDER || 'btcpay';
    
    if (paymentsProvider === 'btcpay') {
      const btcpayUrl = process.env.BTCPAY_URL;
      const btcpayApiKey = process.env.BTCPAY_API_KEY;
      const btcpayStoreId = process.env.BTCPAY_STORE_ID;
      
      if (!btcpayUrl || btcpayUrl.includes('example.com')) {
        errors.push('BTCPAY_URL is required and must not use placeholder value');
      }
      
      if (!btcpayApiKey || btcpayApiKey.includes('your-')) {
        errors.push('BTCPAY_API_KEY is required and must not use placeholder value');
      }
      
      if (!btcpayStoreId || btcpayStoreId.includes('your-')) {
        errors.push('BTCPAY_STORE_ID is required and must not use placeholder value');
      }
      
      // Webhook secret (can fall back to global WEBHOOK_SECRET)
      const btcpayWebhookSecret = process.env.BTCPAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
      if (!btcpayWebhookSecret) {
        warnings.push('BTCPAY_WEBHOOK_SECRET not set (will use WEBHOOK_SECRET as fallback)');
      }
      
    } else if (paymentsProvider === 'lnbits') {
      const lnbitsUrl = process.env.LNBITS_URL;
      const lnbitsApiKey = process.env.LNBITS_API_KEY;
      
      if (!lnbitsUrl) {
        errors.push('LNBITS_URL is required when PAYMENTS_PROVIDER=lnbits');
      }
      
      if (!lnbitsApiKey || lnbitsApiKey.includes('your-')) {
        errors.push('LNBITS_API_KEY is required and must not use placeholder value');
      }
      
      const lnbitsWebhookSecret = process.env.LNBITS_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
      if (!lnbitsWebhookSecret) {
        warnings.push('LNBITS_WEBHOOK_SECRET not set (will use WEBHOOK_SECRET as fallback)');
      }
      
    } else {
      errors.push(`Unknown PAYMENTS_PROVIDER: ${paymentsProvider} (expected: btcpay or lnbits)`);
    }
    
    // Global webhook secret
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.includes('your-')) {
      warnings.push('WEBHOOK_SECRET not set or using placeholder value');
    } else if (webhookSecret.length < 32) {
      warnings.push(`WEBHOOK_SECRET is too short (${webhookSecret.length} chars, recommend 32+)`);
    }
  }

  // ============================================================================
  // OPTIONAL BUT RECOMMENDED
  // ============================================================================
  
  // NIP-05 relays
  const nip05Relays = process.env.NIP05_DEFAULT_RELAYS;
  if (!nip05Relays) {
    warnings.push('NIP05_DEFAULT_RELAYS not set (will use hardcoded defaults)');
  } else {
    const relays = nip05Relays.split(',').map(r => r.trim());
    relays.forEach((relay, idx) => {
      if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) {
        warnings.push(`NIP05_DEFAULT_RELAYS[${idx}] should start with wss:// or ws://: ${relay}`);
      }
    });
  }

  // Node environment
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    warnings.push('NODE_ENV not set (defaulting to development)');
  } else if (nodeEnv === 'production') {
    // Extra validation for production
    if (jwtSecret && jwtSecret.length < 64) {
      warnings.push('In production mode, JWT_SECRET should be at least 64 characters');
    }
  }

  // Redis configuration (optional, falls back to in-memory)
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;
  if (!redisHost || !redisPort) {
    warnings.push('REDIS_HOST or REDIS_PORT not set (will use in-memory cache)');
  }

  // Beacon search integration (optional)
  const beaconApiUrl = process.env.BEACON_API_BASE_URL;
  if (!beaconApiUrl) {
    warnings.push('BEACON_API_BASE_URL not set (Beacon search integration disabled)');
  }

  // ============================================================================
  // FINAL VALIDATION
  // ============================================================================
  
  // If strict mode, treat warnings as errors
  if (strict && warnings.length > 0) {
    errors.push(...warnings.map(w => `[STRICT MODE] ${w}`));
    warnings.length = 0;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation result for logging
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  
  if (result.valid) {
    lines.push('✓ Configuration validation PASSED');
  } else {
    lines.push('✗ Configuration validation FAILED');
  }
  
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('ERRORS:');
    result.errors.forEach((error, idx) => {
      lines.push(`  ${idx + 1}. ${error}`);
    });
  }
  
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('WARNINGS:');
    result.warnings.forEach((warning, idx) => {
      lines.push(`  ${idx + 1}. ${warning}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Validate and throw if invalid
 * Use this at application startup to fail fast
 */
export function validateConfigurationOrThrow(options: ConfigValidationOptions = {}): void {
  const result = validateConfiguration(options);
  
  if (!result.valid) {
    const message = formatValidationResult(result);
    throw new Error(`Configuration validation failed:\n\n${message}\n\nFix the errors above and restart.`);
  }
  
  // Log warnings even if valid
  if (result.warnings.length > 0) {
    console.warn('⚠️  Configuration warnings detected:');
    result.warnings.forEach((warning, idx) => {
      console.warn(`  ${idx + 1}. ${warning}`);
    });
    console.warn('');
  }
}
