// This file defines the User model and keeps auth field rules close to the data layer.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
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

// Hashing lives in the model so every saved user follows the same password rule.
userSchema.pre('save', async function savePassword(next) {
  try {
    // 如果密码没被修改，就不重新加密
    if (!this.isModified('password')) {
      return next();
    }

    // 生成加密盐
    const salt = await bcrypt.genSalt(10);
     // 把明文密码加密成哈希
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

//密码校验，true/false
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

//安全返回用户信息（隐藏密码）
userSchema.methods.toSafeObject = function toSafeObject() {
  const userObject = this.toObject({ versionKey: false });
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
