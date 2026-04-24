import path from 'node:path';
import { promises as fs } from 'node:fs';
import { getAvatarUploadConfig } from '../config/runtime';

class AvatarUploadError extends Error {}

type AvatarTargetUser = {
  _id: unknown;
  username?: string;
  avatarUrl?: string | null;
  avatarType?: string;
};

type UploadResult = {
  avatarUrl: string;
  avatarType: 'uploaded';
  avatarSeed: string;
};

const mimeExtensionMap: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

const sanitizeFileSegment = (value: unknown): string => {
  return String(value || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'user';
};

const getAvatarUploadsDir = () => {
  return path.join(process.cwd(), 'public', 'uploads', 'avatars');
};

const ensureWithinAvatarUploads = (targetPath: string) => {
  const uploadsDir = path.resolve(getAvatarUploadsDir());
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(uploadsDir)) {
    throw new AvatarUploadError('Avatar upload path is invalid.');
  }

  return resolvedTarget;
};

const parseAvatarDataUrl = (value: unknown) => {
  const avatarDataUrl = typeof value === 'string' ? value.trim() : '';

  if (!avatarDataUrl) {
    throw new AvatarUploadError('Avatar file is required.');
  }

  const matched = avatarDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);

  if (!matched) {
    throw new AvatarUploadError('Avatar file must be a valid base64 image.');
  }

  const mimeType = matched[1].toLowerCase();
  const buffer = Buffer.from(matched[2], 'base64');

  if (!buffer.length) {
    throw new AvatarUploadError('Avatar file cannot be empty.');
  }

  return {
    mimeType,
    buffer
  };
};

const removeLocalUploadedAvatar = async (avatarUrl?: string | null) => {
  const { publicBasePath } = getAvatarUploadConfig();

  if (!avatarUrl || !avatarUrl.startsWith(`${publicBasePath}/`)) {
    return;
  }

  const targetPath = ensureWithinAvatarUploads(
    path.join(process.cwd(), avatarUrl.replace(/^\//, '').split('/').join(path.sep))
  );

  try {
    await fs.unlink(targetPath);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      throw error;
    }
  }
};

const saveUploadedAvatar = async (user: AvatarTargetUser, avatarDataUrl: unknown): Promise<UploadResult> => {
  const { maxBytes, allowedMimeTypes, publicBasePath } = getAvatarUploadConfig();
  const { mimeType, buffer } = parseAvatarDataUrl(avatarDataUrl);

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new AvatarUploadError(`Avatar type must be one of: ${allowedMimeTypes.join(', ')}.`);
  }

  if (buffer.length > maxBytes) {
    throw new AvatarUploadError(`Avatar file is too large. Max size is ${Math.floor(maxBytes / 1024)}KB.`);
  }

  const extension = mimeExtensionMap[mimeType];
  if (!extension) {
    throw new AvatarUploadError('Avatar type is not supported.');
  }

  const uploadsDir = getAvatarUploadsDir();
  const fileName = `${String(user._id)}-${sanitizeFileSegment(user.username)}-${Date.now()}.${extension}`;
  const targetPath = ensureWithinAvatarUploads(path.join(uploadsDir, fileName));

  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(targetPath, buffer);

  if (user.avatarType === 'uploaded' && user.avatarUrl) {
    await removeLocalUploadedAvatar(user.avatarUrl);
  }

  return {
    avatarUrl: `${publicBasePath}/${fileName}`,
    avatarType: 'uploaded',
    avatarSeed: sanitizeFileSegment(user.username)
  };
};

export {
  AvatarUploadError,
  removeLocalUploadedAvatar,
  saveUploadedAvatar
};
