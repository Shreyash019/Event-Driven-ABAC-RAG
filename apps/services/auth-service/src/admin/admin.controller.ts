import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { type AdminUserView, AdminService } from './admin.service';
import { GrantDto } from './dto/grant.dto';

/**
 * Admin user-management endpoints (gateway: /api/auth/users*). Authentication is the
 * access token (bearer or arac_session cookie); authorization is scoped RBAC enforced in
 * AdminService — the controller only forwards the token.
 */
@Controller('auth/users')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  async list(@Req() req: Request): Promise<AdminUserView[]> {
    return this.admin.listUsers(accessToken(req));
  }

  @Post(':id/grant')
  async grant(
    @Param('id') id: string,
    @Body() body: GrantDto,
    @Req() req: Request,
  ): Promise<AdminUserView> {
    return this.admin.grantAttributes(accessToken(req), id, body);
  }
}

function accessToken(req: Request): string {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = bearer ?? readCookie(req, 'arac_session');
  if (!token) throw new UnauthorizedException('Missing access token');
  return token;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}
