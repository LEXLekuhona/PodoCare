import { PartialType } from '@nestjs/mapped-types';

import { CreateQuizAdminDto } from './create-quiz-admin.dto';

export class UpdateQuizAdminDto extends PartialType(CreateQuizAdminDto) {}
