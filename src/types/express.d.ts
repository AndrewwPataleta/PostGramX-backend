import { User } from '../modules/auth/entities/user.entity';

declare module 'express' {
    interface Request {
        user?: User;
    }
}
