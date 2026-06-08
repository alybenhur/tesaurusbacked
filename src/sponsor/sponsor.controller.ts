import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SponsorService } from './sponsor.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { SponsorResponseDto, SponsorListResponseDto } from './dto/response-sponsor.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/auth/schemas/user.schema';

const ALLOWED_LOGO_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

@Controller('sponsors')
@UsePipes(new ValidationPipe({ 
  transform: true, 
  whitelist: true,
  forbidNonWhitelisted: true
}))
export class SponsorController {
  constructor(
    private readonly sponsorService: SponsorService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('upload-logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ message: string; logoUrl: string; url: string }> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo de imagen');
    }

    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido (${file.mimetype}). Tipos permitidos: JPG, JPEG, PNG, WEBP, GIF`,
      );
    }

    try {
      const uploadResult = await this.cloudinaryService.uploadFile(file);
      return {
        message: 'Logo subido exitosamente',
        logoUrl: uploadResult.secure_url,
        url: uploadResult.secure_url,
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Error al subir el logo',
        error: error.message,
      });
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSponsorDto: CreateSponsorDto): Promise<{
    message: string;
    sponsor: SponsorResponseDto;
  }> {
    const sponsor = await this.sponsorService.create(createSponsorDto);
    return {
      message: 'Patrocinador creado exitosamente',
      sponsor,
    };
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ): Promise<{
    message: string;
    data: SponsorListResponseDto;
  }> {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;

    // Validar que page y limit sean números positivos
    if (pageNumber < 1 || limitNumber < 1 || limitNumber > 100) {
      throw new Error('Los parámetros de paginación deben ser números positivos (limit máximo: 100)');
    }

    const data = await this.sponsorService.findAll(pageNumber, limitNumber, search);
    return {
      message: 'Patrocinadores obtenidos exitosamente',
      data,
    };
  }

  @Get('count')
  async getCount(): Promise<{
    message: string;
    count: number;
  }> {
    const count = await this.sponsorService.count();
    return {
      message: 'Conteo de patrocinadores obtenido exitosamente',
      count,
    };
  }

  @Get('nit/:nit')
  async findByNit(@Param('nit') nit: string): Promise<{
    message: string;
    sponsor: SponsorResponseDto | null;
  }> {
    const sponsor = await this.sponsorService.findByNit(nit);
    return {
      message: sponsor ? 'Patrocinador encontrado' : 'Patrocinador no encontrado',
      sponsor,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    sponsor: SponsorResponseDto;
  }> {
    const sponsor = await this.sponsorService.findOne(id);
    return {
      message: 'Patrocinador obtenido exitosamente',
      sponsor,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSponsorDto: UpdateSponsorDto,
  ): Promise<{
    message: string;
    sponsor: SponsorResponseDto;
  }> {
    const sponsor = await this.sponsorService.update(id, updateSponsorDto);
    return {
      message: 'Patrocinador actualizado exitosamente',
      sponsor,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<{
    message: string;
  }> {
    const result = await this.sponsorService.remove(id);
    return result;
  }
}