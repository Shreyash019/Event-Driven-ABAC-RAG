import { Body, Controller, Get, Post } from '@nestjs/common';

// Scaffold auth endpoints. The gateway routes /api/auth/* here and validates
// tokens issued from this service (JWKS). Wire real JWT issue/refresh + user
// management in place of these stubs.
@Controller()
export class AuthController {
  @Get('healthz')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Post('auth/login')
  login(@Body() body: { username?: string }): { accessToken: string; tokenType: string } {
    // TODO: verify credentials, sign a real JWT with department/clearance/tenant claims.
    return { accessToken: `stub-token-for-${body?.username ?? 'anon'}`, tokenType: 'Bearer' };
  }

  @Post('auth/refresh')
  refresh(): { accessToken: string; tokenType: string } {
    // TODO: validate refresh token, rotate, re-issue.
    return { accessToken: 'stub-refreshed-token', tokenType: 'Bearer' };
  }
}
