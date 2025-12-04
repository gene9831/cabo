import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ChatModule } from './chat/chat.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    UserModule,
    ChatModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'client', 'dist'),
      exclude: ['/ws*'],
    }),
  ],
})
export class AppModule {}
