import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

let app: INestApplication;

async function bootstrap() {
  app = await NestFactory.create(AppModule);
  await app.listen(4444);
}
bootstrap().catch(err => {
  console.error('Error during the bootstrap:', err);
});

async function gracefulShutdown(_signal: string): Promise<void> {
  try {
    if (app) {
      await app.close();
    }

    process.exit(0);
  } catch (error) {
    console.error(error);

    process.exit(1);
  }
}

process.once('SIGTERM', async () => {
  await gracefulShutdown('SIGTERM');
});
process.once('SIGINT', async () => {
  await gracefulShutdown('SIGINT');
});
process.once('SIGUSR1', async () => {
  await gracefulShutdown('SIGUSR1');
});
process.once('SIGUSR2', async () => {
  await gracefulShutdown('SIGUSR2');
});
