import { Module } from '@nestjs/common';
import { MessageModule } from '../message/message.module';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WsGateway } from './ws.gateway';
import { WsService } from './ws.service';

@Module({
  imports: [UserModule, MessageModule, PrismaModule],
  providers: [WsGateway, WsService],
})
export class WsModule {}
