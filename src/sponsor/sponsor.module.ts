import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SponsorService } from './sponsor.service';
import { SponsorController } from './sponsor.controller';
import { Sponsor, SponsorSchema } from './schemas/sponsor.schema';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sponsor.name, schema: SponsorSchema }
    ]),
    CloudinaryModule,
  ],
  controllers: [SponsorController],
  providers: [SponsorService],
  exports: [SponsorService], // Exportar el servicio para usarlo en otros módulos
})
export class SponsorModule {}