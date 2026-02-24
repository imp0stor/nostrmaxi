import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import helmet from 'helmet';
import { validateConfigurationOrThrow } from './config/validation';
import { runStartupChecks, formatStartupCheckResults } from './config/startup-checks';
import { appLogger } from './common/logger';

async function bootstrap() {
  appLogger.log('🚀 Starting NostrMaxi...\n');

  // ============================================================================
  // PHASE 1: Configuration Validation (Fail Fast)
  // ============================================================================
  appLogger.log('📋 Validating configuration...\n');
  
  try {
    validateConfigurationOrThrow({
      strict: process.env.NODE_ENV === 'production',
      skipPaymentValidation: process.env.SKIP_PAYMENT_VALIDATION === 'true',
    });
    appLogger.log('✓ Configuration validation passed\n');
  } catch (error) {
    appLogger.error('❌ Configuration validation failed!\n');
    appLogger.error(error.message);
    appLogger.error('\nFix the configuration errors above and restart.');
    process.exit(1);
  }

  // ============================================================================
  // PHASE 2: Create Application
  // ============================================================================
  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
  });

  // ⭐ ADD SECURITY HEADERS
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],  // For Swagger UI
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,  // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    xssFilter: true,
  }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ⭐ SECURE CORS CONFIGURATION
  const allowedOrigins = (() => {
    const origins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim());
    
    if (!origins || origins.length === 0) {
      throw new Error(
        'CORS_ORIGINS environment variable is required. ' +
        'Example: CORS_ORIGINS=https://example.com,https://www.example.com'
      );
    }
    
    // Reject wildcard
    if (origins.includes('*')) {
      throw new Error('Wildcard (*) CORS origin not allowed with credentials');
    }
    
    // Validate format
    origins.forEach(origin => {
      if (!origin.match(/^https?:\/\//)) {
        throw new Error(`Invalid CORS origin format: ${origin}`);
      }
    });
    
    // Warn about localhost in production
    if (process.env.NODE_ENV === 'production') {
      const hasLocalhost = origins.some(o => 
        o.includes('localhost') || o.includes('127.0.0.1')
      );
      if (hasLocalhost) {
        throw new Error(
          'localhost/127.0.0.1 detected in CORS_ORIGINS in production mode. ' +
          'This is a security risk. Use proper domain names.'
        );
      }
    }
    
    return origins;
  })();

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('NostrMaxi API')
    .setDescription('Identity & Subscription Platform for Nostr')
    .setVersion('1.0')
    .addTag('health', 'Health check endpoints')
    .addTag('nip05', 'NIP-05 identity management')
    .addTag('wot', 'Web of Trust endpoints')
    .addTag('subscriptions', 'Subscription management')
    .addTag('admin', 'Admin dashboard endpoints')
    .addTag('search', 'Beacon search proxy')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ============================================================================
  // PHASE 3: Startup Health Checks
  // ============================================================================
  appLogger.log('🏥 Running startup health checks...\n');
  
  const prismaService = app.get(PrismaService);
  const startupCheckResult = await runStartupChecks(prismaService);
  
  if (!startupCheckResult.success) {
    appLogger.error('\n❌ Startup checks failed!\n');
    appLogger.error(formatStartupCheckResults(startupCheckResult));
    appLogger.error('\nFix the critical issues above and restart.');
    await app.close();
    process.exit(1);
  }
  
  appLogger.log('✓ All startup checks passed\n');

  // ============================================================================
  // PHASE 4: Start Server
  // ============================================================================
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  appLogger.log('╔════════════════════════════════════════════════════════════════╗');
  appLogger.log('║                                                                ║');
  appLogger.log(`║  🚀 NostrMaxi running on http://localhost:${port}             ║`);
  appLogger.log(`║  📚 API docs: http://localhost:${port}/api/docs               ║`);
  appLogger.log('║  🔒 Security: Helmet, CORS, Rate Limiting enabled             ║');
  appLogger.log(`║  🌍 Environment: ${process.env.NODE_ENV || 'development'}                            ║`);
  appLogger.log(`║  💳 Payment Provider: ${process.env.PAYMENTS_PROVIDER || 'btcpay'}                              ║`);
  appLogger.log('║                                                                ║');
  appLogger.log('╚════════════════════════════════════════════════════════════════╝');
  appLogger.log('');
}

// ============================================================================
// Global Error Handlers
// ============================================================================

process.on('unhandledRejection', (reason, promise) => {
  appLogger.error('❌ Unhandled Rejection at:', promise);
  appLogger.error('Reason:', reason);
  // Don't exit in development, but log clearly
  if (process.env.NODE_ENV === 'production') {
    appLogger.error('Exiting due to unhandled rejection in production mode');
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  appLogger.error('❌ Uncaught Exception:', error);
  // Always exit on uncaught exception - process state is undefined
  appLogger.error('Exiting due to uncaught exception');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  appLogger.log('⚠️  SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  appLogger.log('\n⚠️  SIGINT received, shutting down gracefully...');
  process.exit(0);
});

bootstrap().catch((error) => {
  appLogger.error('❌ Fatal error during bootstrap:', error);
  process.exit(1);
});
