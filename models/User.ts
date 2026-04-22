import bcrypt = require('bcryptjs');
import mongoose = require('mongoose');

type UserRole = 'user' | 'admin';

interface IUser {
  username: string;
  email: string;
  role: UserRole;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserSafeObject {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  role: UserRole;
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
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function savePassword(next) {
  try {
    const user = this as UserDocument;
    if (!user.isModified('password')) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
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
