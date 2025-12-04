import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ClientSocket } from 'src/types';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const wsHost = context.switchToWs();
    const pattern = wsHost.getPattern();

    if (pattern === 'auth') {
      return true;
    }

    const client = wsHost.getClient<ClientSocket>();

    const userId = client.data.userId;

    if (!userId) {
      return false;
    }

    return true;
  }
}
