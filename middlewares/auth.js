import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
const prisma = new PrismaClient();

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorizeTeacher = async (req, res, next) => {
  try {
    const { userId } = req.user;

    // Find the teacher profile using the user's userId
    const teacher = await prisma.teacher.findUnique({
      where: { userId }
    });

    if (!teacher) {
      return res.status(403).json({ message: 'Forbidden: Not a teacher' });
    }

    next();
  } catch (error) {
    console.error('Error in authorizeTeacher middleware:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Teacher profile not found' });
    }
    res.status(500).json({ message: 'Error authorizing teacher', error });
  }
};

export { authenticateUser, authorizeTeacher };