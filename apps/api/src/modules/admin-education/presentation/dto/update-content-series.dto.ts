import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreateContentSeriesDto } from './create-content-series.dto';

/** networkId не меняется через PATCH. */
export class UpdateContentSeriesDto extends PartialType(
  OmitType(CreateContentSeriesDto, ['networkId'] as const),
) {}
