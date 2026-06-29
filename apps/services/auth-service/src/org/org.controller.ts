import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { type DepartmentView, OrgService } from './org.service';
import {
  CreateCompartmentDto,
  CreateDepartmentDto,
  SetCompartmentsDto,
  SetMembershipsDto,
} from './dto/org.dto';

/**
 * Org structure + membership management (gateway: /api/auth/departments*, /compartments*,
 * /users/:id/{departments,compartments}). Authentication is the access token; authorization
 * (users:read / org:manage) is enforced in OrgService.
 */
@Controller('auth')
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Get('departments')
  listDepartments(@Req() req: Request): Promise<DepartmentView[]> {
    return this.org.listDepartments(accessToken(req));
  }

  @Post('departments')
  createDepartment(
    @Body() body: CreateDepartmentDto,
    @Req() req: Request,
  ): Promise<DepartmentView> {
    return this.org.createDepartment(accessToken(req), body);
  }

  @Get('compartments')
  listCompartments(@Req() req: Request): Promise<Array<{ key: string; name: string }>> {
    return this.org.listCompartments(accessToken(req));
  }

  @Post('compartments')
  createCompartment(
    @Body() body: CreateCompartmentDto,
    @Req() req: Request,
  ): Promise<{ key: string; name: string }> {
    return this.org.createCompartment(accessToken(req), body);
  }

  @Put('users/:id/departments')
  async setMemberships(
    @Param('id') id: string,
    @Body() body: SetMembershipsDto,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    await this.org.setUserMemberships(accessToken(req), id, body.memberships);
    return { success: true };
  }

  @Put('users/:id/compartments')
  async setCompartments(
    @Param('id') id: string,
    @Body() body: SetCompartmentsDto,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    await this.org.setUserCompartments(accessToken(req), id, body.keys);
    return { success: true };
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
