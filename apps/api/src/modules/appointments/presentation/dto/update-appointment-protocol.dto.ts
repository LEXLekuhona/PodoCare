import { PartialType } from '@nestjs/swagger';

import { CreateAppointmentProtocolDto } from './create-appointment-protocol.dto';

export class UpdateAppointmentProtocolDto extends PartialType(CreateAppointmentProtocolDto) {}
