import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sponsor, SponsorDocument } from './schemas/sponsor.schema';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { SponsorResponseDto, SponsorListResponseDto } from './dto/response-sponsor.dto';

@Injectable()
export class SponsorService {
  constructor(
    @InjectModel(Sponsor.name) private sponsorModel: Model<SponsorDocument>,
  ) {}

  async create(createSponsorDto: CreateSponsorDto): Promise<SponsorResponseDto> {
    try {
      // Verificar si ya existe un patrocinador con ese NIT
      const existingSponsor = await this.sponsorModel.findOne({ 
        nit: createSponsorDto.nit 
      });

      if (existingSponsor) {
        throw new ConflictException(`Ya existe un patrocinador con el NIT ${createSponsorDto.nit}`);
      }

      // Verificar si ya existe un patrocinador con ese correo
      const existingEmail = await this.sponsorModel.findOne({ 
        correo: createSponsorDto.correo.toLowerCase() 
      });

      if (existingEmail) {
        throw new ConflictException(`Ya existe un patrocinador con el correo ${createSponsorDto.correo}`);
      }

      const createdSponsor = new this.sponsorModel(createSponsorDto);
      const savedSponsor = await createdSponsor.save();
      
      return new SponsorResponseDto(savedSponsor);
    } catch (error) {
      if (error.code === 11000) {
        // Error de duplicado de MongoDB
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(`Ya existe un patrocinador con este ${field}`);
      }
      throw error;
    }
  }

  async findAll(
    page: number = 1, 
    limit: number = 10, 
    search?: string
  ): Promise<SponsorListResponseDto> {
    try {
      const skip = (page - 1) * limit;
      
      // Construir filtro de búsqueda
      const filter: any = {};
      if (search) {
        filter.$or = [
          { nit: { $regex: search, $options: 'i' } },
          { nombreEmpresa: { $regex: search, $options: 'i' } },
          { representanteLegal: { $regex: search, $options: 'i' } },
          { correo: { $regex: search, $options: 'i' } }
        ];
      }

      const [sponsors, total] = await Promise.all([
        this.sponsorModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.sponsorModel.countDocuments(filter).exec(),
      ]);

      return new SponsorListResponseDto({
        sponsors,
        total,
        page,
        limit,
      });
    } catch (error) {
      throw new BadRequestException('Error al obtener la lista de patrocinadores');
    }
  }

  async findOne(id: string): Promise<SponsorResponseDto> {
    try {
      const sponsor = await this.sponsorModel.findById(id).exec();
      
      if (!sponsor) {
        throw new NotFoundException(`Patrocinador con ID ${id} no encontrado`);
      }

      return new SponsorResponseDto(sponsor);
    } catch (error) {
      if (error.name === 'CastError') {
        throw new BadRequestException('ID de patrocinador inválido');
      }
      throw error;
    }
  }

  async findByNit(nit: string): Promise<SponsorResponseDto | null> {
    try {
      const sponsor = await this.sponsorModel.findOne({ nit }).exec();
      
      if (!sponsor) {
        return null;
      }

      return new SponsorResponseDto(sponsor);
    } catch (error) {
      throw new BadRequestException('Error al buscar patrocinador por NIT');
    }
  }

  async update(id: string, updateSponsorDto: UpdateSponsorDto): Promise<SponsorResponseDto> {
    try {
      // Si se está actualizando el NIT, verificar que no exista
      if (updateSponsorDto.nit) {
        const existingSponsor = await this.sponsorModel.findOne({
          nit: updateSponsorDto.nit,
          _id: { $ne: id }
        });

        if (existingSponsor) {
          throw new ConflictException(`Ya existe un patrocinador con el NIT ${updateSponsorDto.nit}`);
        }
      }

      // Si se está actualizando el correo, verificar que no exista
      if (updateSponsorDto.correo) {
        const existingEmail = await this.sponsorModel.findOne({
          correo: updateSponsorDto.correo.toLowerCase(),
          _id: { $ne: id }
        });

        if (existingEmail) {
          throw new ConflictException(`Ya existe un patrocinador con el correo ${updateSponsorDto.correo}`);
        }
      }

      const updatedSponsor = await this.sponsorModel
        .findByIdAndUpdate(id, updateSponsorDto, { 
          new: true,
          runValidators: true 
        })
        .exec();

      if (!updatedSponsor) {
        throw new NotFoundException(`Patrocinador con ID ${id} no encontrado`);
      }

      return new SponsorResponseDto(updatedSponsor);
    } catch (error) {
      if (error.name === 'CastError') {
        throw new BadRequestException('ID de patrocinador inválido');
      }
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(`Ya existe un patrocinador con este ${field}`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      const deletedSponsor = await this.sponsorModel.findByIdAndDelete(id).exec();

      if (!deletedSponsor) {
        throw new NotFoundException(`Patrocinador con ID ${id} no encontrado`);
      }

      return { message: 'Patrocinador eliminado exitosamente' };
    } catch (error) {
      if (error.name === 'CastError') {
        throw new BadRequestException('ID de patrocinador inválido');
      }
      throw error;
    }
  }

  async count(): Promise<number> {
    return this.sponsorModel.countDocuments().exec();
  }

  // En sponsor.service.ts - agregar estos métodos:
/*
async updateUserId(sponsorId: string, userId: Types.ObjectId): Promise<void> {
  await this.sponsorModel.findByIdAndUpdate(
    sponsorId, 
    { userId }, 
    { new: true }
  ).exec();
}
*/

// En sponsor.service.ts:
async updateUserId(sponsorId: string, userId: string): Promise<SponsorResponseDto> {
  try {
    const updatedSponsor = await this.sponsorModel
      .findByIdAndUpdate(
        sponsorId, 
        { userId: new Types.ObjectId(userId) },  // ← Convertir string a ObjectId aquí
        { new: true, runValidators: true }
      )
      .exec();

    if (!updatedSponsor) {
      throw new NotFoundException(`Patrocinador con ID ${sponsorId} no encontrado`);
    }

    return new SponsorResponseDto(updatedSponsor);
  } catch (error) {
    if (error.name === 'CastError') {
      throw new BadRequestException('ID de patrocinador inválido');
    }
    throw error;
  }
}

async hasAssociatedUser(sponsorId: string): Promise<boolean> {
  try {
    const sponsor = await this.sponsorModel.findById(sponsorId).exec();
    
    if (!sponsor) {
      throw new NotFoundException(`Patrocinador con ID ${sponsorId} no encontrado`);
    }

    return sponsor.userId != null;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new BadRequestException('ID de patrocinador inválido');
    }
    throw error;
  }
}

async findByUserId(userId: string): Promise<SponsorResponseDto | null> {
  try {
    const sponsor = await this.sponsorModel.findOne({ userId }).exec();
    
    return sponsor ? new SponsorResponseDto(sponsor) : null;
  } catch (error) {
    throw new BadRequestException('Error al buscar patrocinador por userId');
  }
}

}