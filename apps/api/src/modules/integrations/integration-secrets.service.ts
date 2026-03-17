import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  decryptApplicationValue,
  encryptApplicationValue,
  isEncryptedApplicationValue,
} from '../../common/utils/application-encryption.util';

@Injectable()
export class IntegrationSecretsService {
  encryptSecret(secret: string) {
    try {
      return encryptApplicationValue(secret);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Integration secret could not be encrypted.',
      );
    }
  }

  decryptSecret(secret: string) {
    try {
      return decryptApplicationValue(secret);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Stored integration secret could not be decrypted with the configured key.',
      );
    }
  }

  isEncryptedSecret(value: string) {
    return isEncryptedApplicationValue(value);
  }

  maskSecret(secret: string, options?: { prefixChars?: number; suffixChars?: number }) {
    const normalized = secret.trim();

    if (!normalized) {
      return null;
    }

    const prefixChars = options?.prefixChars ?? 4;
    const suffixChars = options?.suffixChars ?? 4;

    if (normalized.length <= prefixChars + suffixChars) {
      return `${normalized.slice(0, 1)}***${normalized.slice(-1)}`;
    }

    return `${normalized.slice(0, prefixChars)}***${normalized.slice(-suffixChars)}`;
  }
}
