import express, { text } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
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
router.post('/request-password-reset', async (req, res) => {
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
    const resetLink = `${process.env.BASE_URL}/reset-password?token=${token}`;

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Reset EI-LMS Password',
      text: `Click the link below to reset your password:\n\n${resetLink}`,
      html: `<p>Click the link below to reset your password:</p><p><a href="${resetLink}">Reset Password</a></p>`
    };

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




// Change Password







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
