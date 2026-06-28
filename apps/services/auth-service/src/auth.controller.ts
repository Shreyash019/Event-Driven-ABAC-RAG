import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { SessionUser } from '@arac/types';
import { AuthService } from './auth/auth.service';
import { LoginDto } from './auth/dto/login.dto';
import { ChangePasswordDto, SignupDto } from './auth/dto/account.dto';
import type { AuthResult } from './auth/auth.service';
import type { CookieConfig } from './config/configuration';

/** DI token for the cookie slice of AppConfig (wired in app.module). */
export const COOKIE_CONFIG = Symbol('COOKIE_CONFIG');

// Access JWT lives in `arac_session` (read by the Next.js BFF for SSR; see
// apps/web/*/src/lib/session.ts). The refresh token lives in `arac_refresh`, scoped to
// the auth path so it is sent ONLY to refresh/logout, never to every request.
const ACCESS_COOKIE = 'arac_session';
const REFRESH_COOKIE = 'arac_refresh';
const REFRESH_PATH = '/api/auth';

/**
 * Auth endpoints behind the gateway (loc-doc/AuthService.md §5). The gateway routes
 * /api/auth/* here and pulls JWKS from JwksController to validate the tokens we issue.
 *
 * Both tokens are delivered as httpOnly cookies (BFF pattern) so browser JS never
 * touches them. Refresh tokens are NEVER returned in a response body — only via the
 * httpOnly cookie. Every error path clears cookies and issues nothing (fail-closed).
 */
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(COOKIE_CONFIG) private readonly cookies: CookieConfig,
  ) {}

  @Get('healthz')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Post('auth/login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const result = await this.auth.login(body.email, body.password);
    this.setAuthCookies(res, result);
    return this.publicBody(result);
  }

  @Post('auth/signup')
  async signup(
    @Body() body: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const result = await this.auth.signup(body.email, body.name, body.password);
    this.setAuthCookies(res, result); // auto-login the new account
    return this.publicBody(result);
  }

  @Post('auth/refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const token = this.readCookie(req, REFRESH_COOKIE);
    if (!token) throw new UnauthorizedException('Missing refresh token');
    try {
      const result = await this.auth.refresh(token);
      this.setAuthCookies(res, result);
      return this.publicBody(result);
    } catch (err) {
      // Reuse-detected / invalid / expired → drop the stale cookies in the browser too.
      this.clearAuthCookies(res);
      throw err;
    }
  }

  @Post('auth/logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const token = this.readCookie(req, REFRESH_COOKIE);
    if (token) await this.auth.logout(token);
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Post('auth/logout-all')
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    await this.auth.logoutAll(this.requireAccessToken(req));
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Post('auth/change-password')
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const result = await this.auth.changePassword(
      this.requireAccessToken(req),
      body.currentPassword,
      body.newPassword,
    );
    this.setAuthCookies(res, result); // re-issued session after revoking all others
    return this.publicBody(result);
  }

  @Get('auth/me')
  async me(@Req() req: Request): Promise<SessionUser> {
    return this.auth.me(this.requireAccessToken(req));
  }

  // --- helpers --------------------------------------------------------------

  private publicBody(result: AuthResult): { user: SessionUser } {
    // Cookie-only token delivery: NEITHER the access nor the refresh token appears in a
    // JS-readable body. Both live solely in httpOnly cookies, so XSS cannot read them and
    // the browser only ever receives the minimal SessionUser (data minimization / GDPR).
    return { user: result.user };
  }

  private requireAccessToken(req: Request): string {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer ?? this.readCookie(req, ACCESS_COOKIE);
    if (!token) throw new UnauthorizedException('Missing access token');
    return token;
  }

  private setAuthCookies(res: Response, result: AuthResult): void {
    const base = {
      httpOnly: true,
      secure: this.cookies.secure,
      sameSite: this.cookies.sameSite,
      domain: this.cookies.domain,
    } as const;
    res.cookie(ACCESS_COOKIE, result.accessToken, {
      ...base,
      path: '/',
      maxAge: this.maxAge(result.accessExpiresAt),
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...base,
      path: REFRESH_PATH,
      maxAge: this.maxAge(result.refreshExpiresAt),
    });
  }

  private clearAuthCookies(res: Response): void {
    const base = { domain: this.cookies.domain } as const;
    res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
  }

  /** Cookie lifetime in ms from a unix-seconds expiry; floored at 0. */
  private maxAge(expiresAt: number): number {
    return Math.max(0, expiresAt * 1000 - Date.now());
  }

  /** Parse a single cookie value from the request's Cookie header (no cookie-parser dep). */
  private readCookie(req: Request, name: string): string | undefined {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      if (part.slice(0, eq).trim() === name) {
        return decodeURIComponent(part.slice(eq + 1).trim());
      }
    }
    return undefined;
  }
}
