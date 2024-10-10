import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GithubModule } from './github/github.module';
import { CacheModule } from '@nestjs/cache-manager/dist/cache.module';

@Module({
  imports: [
    GithubModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 3600, // 캐시 유효 시간 (초)
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
