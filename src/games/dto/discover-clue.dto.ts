import { IsLatitude, IsLongitude, IsMongoId, IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";

export class DiscoverClueDto {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  clueId: string;

  @IsString()
  @IsNotEmpty()
  playerId: string;

  @IsNumber()
  @IsLatitude()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @IsLongitude()
  @Min(-180)
  @Max(180)
  longitude: number;
}