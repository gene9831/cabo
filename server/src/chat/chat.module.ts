import { Module } from '@nestjs/common';
import { MessageModule } from '../message/message.module';
import { UserModule } from '../user/user.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [UserModule, MessageModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
