import { PartialType } from '@nestjs/mapped-types';

import { CreateReminderPolicyDto } from './create-reminder-policy.dto';

export class UpdateReminderPolicyDto extends PartialType(CreateReminderPolicyDto) {}
