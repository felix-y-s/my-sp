import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const mongoConfig = configService.get('mongodb');
        
        // MongoDB URI가 제공된 경우 우선 사용
        if (mongoConfig.uri && mongoConfig.uri !== 'mongodb://localhost:27017/purchase_saga_mongo') {
          return {
            uri: mongoConfig.uri,
            connectionFactory: (connection) => {
              connection.on('connected', () => {
                console.log('MongoDB 연결이 성공적으로 설정되었습니다.');
              });
              connection.on('error', (error) => {
                console.error('MongoDB 연결 오류:', error);
              });
              connection.on('disconnected', () => {
                console.log('MongoDB 연결이 해제되었습니다.');
              });
              return connection;
            },
          };
        }

        // 개별 설정을 사용하여 URI 구성
        let uri = `mongodb://`;
        
        if (mongoConfig.username && mongoConfig.password) {
          uri += `${mongoConfig.username}:${mongoConfig.password}@`;
        }
        
        uri += `${mongoConfig.host}:${mongoConfig.port}/${mongoConfig.database}`;
        
        // 추가 옵션들
        const options = [];
        if (mongoConfig.authSource) {
          options.push(`authSource=${mongoConfig.authSource}`);
        }
        if (mongoConfig.replicaSet) {
          options.push(`replicaSet=${mongoConfig.replicaSet}`);
        }
        if (mongoConfig.ssl) {
          options.push('ssl=true');
        }
        
        if (options.length > 0) {
          uri += `?${options.join('&')}`;
        }

        return {
          uri,
          maxPoolSize: mongoConfig.maxPoolSize,
          minPoolSize: mongoConfig.minPoolSize,
          maxIdleTimeMS: mongoConfig.maxIdleTimeMS,
          serverSelectionTimeoutMS: mongoConfig.serverSelectionTimeoutMS,
          socketTimeoutMS: mongoConfig.socketTimeoutMS,
          connectTimeoutMS: mongoConfig.connectTimeoutMS,
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              console.log('MongoDB 연결이 성공적으로 설정되었습니다.');
              console.log(`연결된 데이터베이스: ${mongoConfig.database}`);
            });
            connection.on('error', (error) => {
              console.error('MongoDB 연결 오류:', error);
            });
            connection.on('disconnected', () => {
              console.log('MongoDB 연결이 해제되었습니다.');
            });
            return connection;
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class MongoDbModule {}