import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Response status',
    example: 'error',
    enum: ['error'],
  })
  status: 'error';

  @ApiProperty({
    description: 'Error message',
    example: 'Validation error',
  })
  message: string;
}
