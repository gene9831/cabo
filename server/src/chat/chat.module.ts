import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
