import { ApiProperty } from '@nestjs/swagger';

export class CreateArticleResponseDto {
  @ApiProperty({
    description: 'Response status',
    example: 'ok',
    enum: ['ok', 'error'],
  })
  status: 'ok' | 'error';

  @ApiProperty({
    description: 'Response message',
    example: 'News stored and queued',
  })
  message: string;

  @ApiProperty({
    description: 'Article ID (only present when status is ok)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  id?: string;
}
