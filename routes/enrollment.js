import express from 'express';
import { PrismaClient, EnrollmentStatus } from '@prisma/client';
import { authenticateUser, authorizeTeacher } from '../middlewares/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Student applies for course enrollment
router.post('/enrollments', authenticateUser, async (req, res) => {
    try {
      const { courseId } = req.body;
      const { userId } = req.user;
  
      const student = await prisma.student.findUnique({
        where: { userId: userId }
      });
  
      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }
  
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          courseId: parseInt(courseId),
          status: 'PENDING'
        },
        include: {
          course: {
            select: {
              name: true,
              courseCode: true
            }
          }
        }
      });
  
      res.status(201).json(enrollment);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Already enrolled or applied for this course' });
      }
      res.status(500).json({ message: 'Error applying for enrollment', error });
    }
  });

  // Teacher approves or rejects student's enrollment
  router.put('/enrollments/:id/status', authenticateUser, authorizeTeacher, async (req, res) => {
    try {
      const enrollmentId = parseInt(req.params.id);
      const { status } = req.body;
      const { userId } = req.user;

      const validStatuses = Object.values(EnrollmentStatus);
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      const teacher = await prisma.teacher.findUnique({
        where: { userId: userId }
      });

      if (!teacher) {
        return res.status(403).json({ message: 'Teacher not found' });
      }

      // First verify the enrollment exists and belongs to one of teacher's courses
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          AND: [
            { id: enrollmentId },
            {
              course: {
                teacherId: teacher.id
              }
            }
          ]
        },
        include: {
          course: true,
          student: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (!enrollment) {
        return res.status(404).json({ 
          message: 'Enrollment not found or you are not authorized to modify it'
        });
      }

      // Update the enrollment
      const updatedEnrollment = await prisma.enrollment.update({
        where: { 
          id: enrollmentId,
        },
        data: { 
          status: status 
        },
        include: {
          course: {
            select: {
              name: true,
              courseCode: true
            }
          },
          student: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });

      return res.json(updatedEnrollment);

    } catch (error) {
      console.error('Detailed error:', error); // Add detailed logging
      
      if (error.code === 'P2025') {
        return res.status(404).json({ 
          message: 'Enrollment record not found'
        });
      }
      
      if (error.code === 'P2002') {
        return res.status(409).json({ 
          message: 'Unique constraint violation'
        });
      }

      return res.status(500).json({ 
        message: 'Error updating enrollment status',
        error: error.message || 'Unknown error'
      });
    }
});

// Get pending enrollments for teacher's courses
router.get('/enrollments/pending', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const { userId } = req.user;

    const teacher = await prisma.teacher.findUnique({
      where: { userId: userId }
    });

    const pendingEnrollments = await prisma.enrollment.findMany({
      where: {
        status: 'PENDING',
        course: {
          teacherId: teacher.id
        }
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            enrollmentNumber: true
          }
        },
        course: {
          select: {
            name: true,
            courseCode: true
          }
        }
      }
    });

    res.json(pendingEnrollments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending enrollments', error });
  }
});

// Get student's enrolled courses
router.get('/enrollments/my-courses', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.user;  // Changed from id to userId

    console.log('User info:', { userId });

    const student = await prisma.student.findUnique({
      where: { userId: userId }
    });

    console.log('Student found:', student);

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: student.id
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            courseCode: true,
            session: true,
            semester: true,
            teacher: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            enrollmentNumber: true
          }
        }
      }
    });

    console.log('Enrollments found:', enrollments);

    res.json(enrollments);
  } catch (error) {
    console.error('Detailed error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });

    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'No enrollments found' });
    }

    res.status(500).json({ 
      message: 'Error fetching enrolled courses', 
      details: error.message,
      code: error.code
    });
  }
});

// Get student profile
router.get('/student-profile', authenticateUser, async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        userId: parseInt(req.user.id)
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;