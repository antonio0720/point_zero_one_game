import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { UserService } from '../user/user.service';

@Injectable()
export class JwtIdentityStrategy extends PassportStrategy(JwtStrategy) {
constructor(private userService: UserService, private jwtService: JwtService) {
super({
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
secretOrKey: process.env.SECRET_KEY,
});
}

async validate(payload: any) {
const user = await this.userService.findOne(payload.sub);

if (!user) {
throw new UnauthorizedException();
}

return user;
}
}

import { Injectable, UseGuards } from '@nestjs/common';
import { JwtGuard } from './jwt-identity.strategy';
import { UserEntity } from '../user/entities/user.entity';
import { GetUser } from './get-user.decorator';
import { UsersService } from '../user/users.service';

@Injectable()
export class AuthController {
constructor(private userService: UsersService) {}

@UseGuards(JwtGuard)
async getUser(@GetUser() user: UserEntity) {
return this.userService.findOne(user.id);
}
}
