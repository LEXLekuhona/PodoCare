import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreateProgramDto } from './create-program.dto';

export class UpdateProgramDto extends PartialType(OmitType(CreateProgramDto, ['networkId'] as const)) {}
