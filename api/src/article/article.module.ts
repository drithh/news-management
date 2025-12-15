import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '@/article/article.entity';
import { ArticleService } from '@/article/article.service';
import { ArticleController } from '@/article/article.controller';
import { MessageQueueModule } from '@/message-queue/message-queue.module';

@Module({
  imports: [TypeOrmModule.forFeature([Article]), MessageQueueModule],
  providers: [ArticleService],
  controllers: [ArticleController],
})
export class ArticleModule {}
