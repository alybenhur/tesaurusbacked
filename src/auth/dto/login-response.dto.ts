// auth/dto/login-response.dto.ts
import { Expose, Transform } from 'class-transformer';

export class LoginResponseDto {
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  _id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  role: string;

  @Expose()
  isActive: boolean;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  lastLogin?: string;

  @Expose()
  discoveredClues: string[];

  @Expose()
  totalScore: number;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  createdAt?: string;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  updatedAt?: string;

  @Expose()
  __v?: number;
}