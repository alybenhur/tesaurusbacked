export class PasswordResetRequestResponseDto {
  message: string;
  expiresAt: Date;
  attemptsRemaining?: number;
}

export class VerifyResetTokenResponseDto {
  message: string;
  isValid: boolean;
  canProceed: boolean;
  attemptsRemaining?: number;
}

export class ResetPasswordResponseDto {
  message: string;
  success: boolean;
}