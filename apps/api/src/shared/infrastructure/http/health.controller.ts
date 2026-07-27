import { Controller, Get, HttpCode, HttpStatus, Logger, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DataSource } from 'typeorm';

export class HealthResponse {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status: 'ok' | 'degraded';

  @ApiProperty({ enum: ['up', 'down'] })
  database: 'up' | 'down';

  @ApiProperty({ example: 42 })
  uptimeSeconds: number;

  @ApiProperty()
  timestamp: string;
}

const DATABASE_TIMEOUT_MS = 3000;

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness: proceso vivo y base de datos alcanzable' })
  @ApiOkResponse({ type: HealthResponse })
  @ApiServiceUnavailableResponse({ description: 'La base de datos no responde.' })
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const database = (await this.isDatabaseReachable()) ? 'up' : 'down';

    if (database === 'down') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async isDatabaseReachable(): Promise<boolean> {
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), DATABASE_TIMEOUT_MS),
        ),
      ]);
      return true;
    } catch (cause) {
      this.logger.error('La base de datos no respondió al health check.', cause);
      return false;
    }
  }
}
