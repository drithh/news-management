import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from '@/search/search.service';
import { SearchController } from '@/search/search.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
