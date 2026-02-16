import { logger } from '../../shared/logger/logger';
import UserRepository from './user.repository';
import UserService from './user.service';

interface UserContainer {
  userRepository: UserRepository;
  userService: UserService;
}

const createUserContainer = (): UserContainer => {
  const userRepository = new UserRepository();
  const userService = new UserService(userRepository, logger);

  return { userRepository, userService };
};

export const { userRepository, userService } = createUserContainer();
