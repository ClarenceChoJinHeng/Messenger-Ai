import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  // A fake AuthService, so this test needs no database
  const authService = {
    register: vi.fn(async (body: { username: string; email: string }) => ({ id: 1, ...body })),
    login: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('passes the register body to the service and returns its result', async () => {
    const body = { username: 'clarence', email: 'c@mail.com', password: 'secret123' };
    await expect(controller.register(body)).resolves.toEqual({ id: 1, ...body });
    expect(authService.register).toHaveBeenCalledWith(body);
  });
});
