import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Health status',
    example: 'ok',
    enum: ['ok'],
  })
  status: 'ok';

  @ApiProperty({
    description: 'Current timestamp in ISO 8601 format',
    example: '2025-01-01T12:00:00.000Z',
  })
  timestamp: string;
}
