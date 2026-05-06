import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreateContentSeriesDto } from './create-content-series.dto';

export class UpdateContentSeriesDto extends PartialType(
  OmitType(CreateContentSeriesDto, ['networkId'] as const),
) {}
