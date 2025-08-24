import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const dbType = configService.get<string>('DATABASE_TYPE', 'sqlite');
        
        const baseConfig = {
          entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('NODE_ENV') !== 'production',
          logging: configService.get<string>('NODE_ENV') === 'development',
          migrations: [__dirname + '/../../database/migrations/*{.ts,.js}'],
          migrationsRun: configService.get<string>('NODE_ENV') !== 'development',
        };

        if (dbType === 'postgres') {
          return {
            type: 'postgres',
            host: configService.get<string>('DATABASE_HOST', 'localhost'),
            port: configService.get<number>('DATABASE_PORT', 5432),
            database: configService.get<string>('DATABASE_NAME'),
            username: configService.get<string>('DATABASE_USERNAME'),
            password: configService.get<string>('DATABASE_PASSWORD'),
            ssl: configService.get<string>('NODE_ENV') === 'production' 
              ? { rejectUnauthorized: false } 
              : false,
            ...baseConfig,
          };
        }

        // SQLite fallback (기존 호환성 유지)
        return {
          type: 'sqlite',
          database: configService.get<string>('DATABASE_NAME', 'purchase_saga.db'),
          ...baseConfig,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
