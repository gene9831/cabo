import { Injectable } from '@nestjs/common';
import { Prisma, Message } from 'src/generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  async message(where: Prisma.MessageWhereUniqueInput): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where,
    });
  }

  async messages(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.MessageWhereUniqueInput;
    where?: Prisma.MessageWhereInput;
    orderBy?: Prisma.MessageOrderByWithRelationInput;
    include?: Prisma.MessageInclude;
  }): Promise<Message[]> {
    const { skip, take, cursor, where, orderBy, include } = params;
    return this.prisma.message.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include,
    });
  }

  async createMessage(data: Prisma.MessageCreateInput, include?: Prisma.MessageInclude): Promise<Message> {
    return this.prisma.message.create({
      data,
      include,
    });
  }

  async updateMessage(params: {
    where: Prisma.MessageWhereUniqueInput;
    data: Prisma.MessageUpdateInput;
  }): Promise<Message> {
    const { where, data } = params;
    return this.prisma.message.update({
      data,
      where,
    });
  }

  async deleteMessage(where: Prisma.MessageWhereUniqueInput): Promise<Message> {
    return this.prisma.message.delete({
      where,
    });
  }
}
