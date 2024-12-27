import express, { text } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { transporter, getMailOptions } from '../middlewares/emailconfig.js';
const router = express.Router();
const prisma = new PrismaClient();

// Middleware to validate request body
const validateRegistration = (req, res, next) => {
  const { firstName, lastName, email, password, role } = req.body;
  
  if (!firstName || !lastName || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  if (password.length < 4) {
    return res.status(400).json({ message: 'Password must be at least 4 characters' });
  }
  
  if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  
  next();
};

// Register route
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { enrollmentNumber, firstName, lastName, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Create base user
      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: hashedPassword,
          role,
        }
      });

      // Create role-specific profile
      switch (role) {
        case 'STUDENT':
          await prisma.student.create({
            data: {
              firstName,
              lastName,
              userId: user.id,
              enrollmentNumber
            }
          });
          break;
        case 'TEACHER':
          await prisma.teacher.create({
            data: {
              firstName,
              lastName,
              userId: user.id
            }
          });
          break;
        case 'ADMIN':
          await prisma.admin.create({
            data: {
              firstName,
              lastName,
              userId: user.id
            }
          });
          break;
      }

      return user;
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.id, role: result.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: result.id,
        email: result.email,
        role: result.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});


// Request Password Reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate request body
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate password reset token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Check if a reset token already exists for the user
    const existingToken = await prisma.resetToken.findUnique({
      where: { userId: user.id }
    });

    if (existingToken) {
      // Update the existing token
      await prisma.resetToken.update({
        where: { userId: user.id },
        data: {
          token,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
        }
      });
    } else {
      // Create a new token
      await prisma.resetToken.create({
        data: {
          token,
          userId: user.id
        }
      });
    }

    // Configure password reset link
    const resetLink = `${process.env.BASE_URL}/change-password?token=${token}`;

    // Send email
    const mailOptions = getMailOptions(email, user, resetLink);
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(200).json({ message: 'Email sent: ' + info.response });
      }
    });
    res.json({ message: 'Password reset email sent successfully' });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Error requesting password reset' });
  }
});

// Change Password route
router.post('/change-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validate request body
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Find reset token
    const resetToken = await prisma.resetToken.findUnique({
      where: { token }
    });

    if (!resetToken) {
      return res.status(404).json({ message: 'Invalid or expired token' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // Check if token is expired
    if (new Date(resetToken.expiresAt) < new Date()) {
      return res.status(403).json({ message: 'Token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword }
    });

    // Delete reset token
    await prisma.resetToken.delete({
      where: { id: resetToken.id }
    });

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Protected route example - Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        student: true,
        teacher: true,
        admin: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

export default router;
