export class SponsorResponseDto {
  _id: string;
  nit: string;
  nombreEmpresa: string;
  representanteLegal: string;
  celular: string;
  correo: string;
  logo: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(sponsor: any) {
    this._id = sponsor._id?.toString();
    this.nit = sponsor.nit;
    this.nombreEmpresa = sponsor.nombreEmpresa;
    this.representanteLegal = sponsor.representanteLegal;
    this.celular = sponsor.celular;
    this.correo = sponsor.correo;
    this.logo = sponsor.logo;
    this.createdAt = sponsor.createdAt;
    this.updatedAt = sponsor.updatedAt;
  }
}

export class SponsorListResponseDto {
  sponsors: SponsorResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(data: {
    sponsors: any[];
    total: number;
    page: number;
    limit: number;
  }) {
    this.sponsors = data.sponsors.map(sponsor => new SponsorResponseDto(sponsor));
    this.total = data.total;
    this.page = data.page;
    this.limit = data.limit;
    this.totalPages = Math.ceil(data.total / data.limit);
  }
}