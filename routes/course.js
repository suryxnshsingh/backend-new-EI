import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeTeacher } from '../middlewares/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Create a new course (Teachers only)
router.post('/courses', authenticateUser, authorizeTeacher, async (req, res) => {
    try {
      const { name, courseCode, session, semester } = req.body;
      
      // Debug log 1: Request body
      console.log('Request body:', req.body);
      
      // Debug log 2: User info
      console.log('User info:', req.user);

      const { userId } = req.user;
  
      const teacher = await prisma.teacher.findUnique({
        where: { userId: userId }
      });
      
      // Debug log 3: Teacher info
      console.log('Teacher found:', teacher);
  
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }
  
      // Debug log 4: Data being sent to create
      console.log('Creating course with data:', {
        name,
        courseCode,
        session,
        semester,
        teacherId: teacher.id
      });

      const course = await prisma.course.create({
        data: {
          name,
          courseCode,
          session,
          semester,
          teacherId: teacher.id
        },
        include: {
          teacher: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });
  
      res.status(201).json(course);
    } catch (error) {
      // Enhanced error logging
      console.error('Detailed error:', {
        name: error.name,
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack
      });

      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Course code already exists' });
      } else if (error.code === 'P2003') {
        return res.status(400).json({ message: 'Invalid teacher ID' });
      } else {
        res.status(500).json({ 
          message: 'Error creating course', 
          details: error.message,
          name: error.name
        });
      }
    }
  });

// Get all courses with enrollment counts
router.get('/all-courses', authenticateUser, async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: { enrollments: true }
        }
      }
    });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching courses', error });
  }
});

// Get teacher's courses
router.get('/teacher-courses', authenticateUser, async (req, res) => {
    try {
      const { userId } = req.user;
      
      // First find the teacher
      const teacher = await prisma.teacher.findUnique({
        where: { userId: userId }
      });

      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }

      // Then find courses using teacher's ID
      const courses = await prisma.course.findMany({
        where: {
          teacherId: teacher.id  // Use teacher.id instead of userId
        },
        include: {
          teacher: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: { enrollments: true }
          }
        }
      });
      
      res.json(courses);
    } catch (error) {
      console.error('Detailed error:', {
        name: error.name,
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Error fetching courses', 
        details: error.message 
      });
    }
  });

// Get course details with enrolled students
router.get('/courses/:id', authenticateUser, async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        enrollments: {
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
                enrollmentNumber: true
              }
            }
          }
        }
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching course details', error });
  }
});

// Update course details (Teachers only)
router.put('/courses/:id', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const { name, courseCode, session, semester } = req.body;
    const { userId } = req.user;  // Changed from id

    const teacher = await prisma.teacher.findUnique({
      where: { userId: userId }
    });

    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        teacherId: teacher.id
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        name,
        courseCode,
        session,
        semester
      }
    });

    res.json(updatedCourse);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Course code already exists' });
    }
    res.status(500).json({ message: 'Error updating course', error });
  }
});

// Delete course (Teachers only)
router.delete('/courses/:id', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const { userId } = req.user;

    const teacher = await prisma.teacher.findUnique({
      where: { userId: userId }
    });

    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        teacherId: teacher.id
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    await prisma.course.delete({
      where: { id: courseId }
    });

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting course', error });
  }
});


export default router;