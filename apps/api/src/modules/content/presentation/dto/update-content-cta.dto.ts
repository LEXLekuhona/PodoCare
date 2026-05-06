import { PartialType } from '@nestjs/mapped-types';

import { CreateContentCtaDto } from './create-content-cta.dto';

export class UpdateContentCtaDto extends PartialType(CreateContentCtaDto) {}
