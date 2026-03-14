import { logger } from '../../shared/logger/logger';
import { userRepository } from '../user/user.container';
import { FelboCoinRepository } from './felbocoin.repository';
import { FelboCoinService } from './felbocoin.service';
import { FelboCoinController } from './felbocoin.controller';

const felboCoinRepository = new FelboCoinRepository();

export const felboCoinService = new FelboCoinService(
  felboCoinRepository,
  () => userRepository,
  logger,
);

const felboCoinController = new FelboCoinController(felboCoinService);

export { felboCoinController, felboCoinRepository };
