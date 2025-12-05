import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AuthDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  username?: string;
}

export class MessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class SetUsernameDto {
  @IsString()
  @IsNotEmpty()
  username: string;
}
