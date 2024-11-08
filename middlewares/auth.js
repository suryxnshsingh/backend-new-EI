import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
const prisma = new PrismaClient();

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const authorizeTeacher = async (req, res, next) => {
  try {
    const { id, firstName, lastName } = req.user;

    // Find the teacher profile using the user's first and last name 
    const teacher = await prisma.teacher.findFirst({
      where: {
        firstName,
        lastName
      }
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