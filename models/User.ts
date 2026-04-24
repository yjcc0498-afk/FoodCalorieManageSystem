import bcrypt = require('bcryptjs');
import mongoose = require('mongoose');

type UserRole = 'user' | 'admin';
type AvatarType = 'default' | 'uploaded';

const createAvatarSeed = (value: unknown): string => {
  const normalizedValue = String(value || 'user').trim().toLowerCase();
  const sanitizedValue = normalizedValue
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitizedValue || 'user';
};

interface IUser {
  username: string;
  email: string;
  role: UserRole;
  password: string;
  bio?: string | null;
  height?: number | null;
  age?: number | null;
  weight?: number | null;
  targetWeight?: number | null;
  dailyCalorieGoal?: number | null;
  avatarUrl?: string | null;
  avatarType: AvatarType;
  avatarSeed: string;
  lastLoginAt?: Date | null;
  passwordChangedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserSafeObject {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  role: UserRole;
  bio?: string | null;
  height?: number | null;
  age?: number | null;
  weight?: number | null;
  targetWeight?: number | null;
  dailyCalorieGoal?: number | null;
  avatarUrl?: string | null;
  avatarType: AvatarType;
  avatarSeed: string;
  lastLoginAt?: Date | null;
  passwordChangedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toSafeObject(): UserSafeObject;
}

type UserDocument = mongoose.HydratedDocument<IUser, UserMethods>;
type UserModel = mongoose.Model<IUser, object, UserMethods>;

const userSchema = new mongoose.Schema<IUser, UserModel, UserMethods>(
  {
    username: {
      type: String,
      required: [true, 'Username is required.'],
      unique: true,
      trim: true,
      lowercase: true
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.']
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [6, 'Password must be at least 6 characters long.'],
      select: false
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [280, 'Bio cannot exceed 280 characters.'],
      default: null
    },
    height: {
      type: Number,
      min: [0, 'Height cannot be negative.'],
      default: null
    },
    age: {
      type: Number,
      min: [0, 'Age cannot be negative.'],
      default: null
    },
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative.'],
      default: null
    },
    targetWeight: {
      type: Number,
      min: [0, 'Target weight cannot be negative.'],
      default: null
    },
    dailyCalorieGoal: {
      type: Number,
      min: [0, 'Daily calorie goal cannot be negative.'],
      default: null
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(this: IUser, value?: string | null) {
          if (this.avatarType !== 'uploaded') {
            return true;
          }

          return Boolean(typeof value === 'string' && value.trim());
        },
        message: 'Avatar URL is required when avatar type is uploaded.'
      }
    },
    avatarType: {
      type: String,
      enum: ['default', 'uploaded'],
      default: 'default'
    },
    avatarSeed: {
      type: String,
      trim: true,
      default: ''
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    passwordChangedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('validate', function normalizeProfile(next) {
  try {
    const user = this as UserDocument;

    if (typeof user.bio === 'string') {
      const normalizedBio = user.bio.trim();
      user.bio = normalizedBio ? normalizedBio : null;
    }

    if (user.avatarType === 'default') {
      user.avatarUrl = null;

      if (!user.avatarSeed || user.isModified('username')) {
        user.avatarSeed = createAvatarSeed(user.username);
      }
    } else if (typeof user.avatarUrl === 'string') {
      user.avatarUrl = user.avatarUrl.trim();
    }

    if (!user.avatarSeed) {
      user.avatarSeed = createAvatarSeed(user.username);
    }

    return next();
  } catch (error) {
    return next(error as mongoose.CallbackError);
  }
});

userSchema.pre('save', async function savePassword(next) {
  try {
    const user = this as UserDocument;
    if (!user.isModified('password')) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    user.passwordChangedAt = new Date();
    return next();
  } catch (error) {
    return next(error as mongoose.CallbackError);
  }
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const userObject = this.toObject({ versionKey: false }) as Omit<IUser, 'password'> & {
    _id: mongoose.Types.ObjectId;
    password?: string;
  };

  delete userObject.password;
  return userObject as UserSafeObject;
};

const User = mongoose.model<IUser, UserModel>('User', userSchema);

export = User;
