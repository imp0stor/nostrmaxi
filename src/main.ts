import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 NostrMaxi running on http://localhost:${port}`);
  console.log(`📚 API docs: http://localhost:${port}/api/docs`);
}
bootstrap();
