import { Module, forwardRef } from '@nestjs/common';
import { WebsocketsGateway } from './websockets.gateway';

@Module({
  providers: [WebsocketsGateway],
  exports: [WebsocketsGateway], // Exportar el gateway para uso en otros módulos
})
export class WebsocketsModule {}