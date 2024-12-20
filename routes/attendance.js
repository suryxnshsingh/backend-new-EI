import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middlewares/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

//-------------------------------------TEACHER-------------------------------------


// Teacher creates attendance Session for a course
router.post('/attendance', authenticateUser, async (req, res) => {
    const { courseId, teacherId, date, duration } = req.body;
    try {
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course || course.teacherId !== teacherId) {
            return res.status(400).json({ error: 'Invalid course or unauthorized teacher.' });
        }

        const existingSession = await prisma.attendance.findFirst({
            where: { courseId, isActive: true },
        });
        if (existingSession) {
            return res.status(400).json({ error: 'Active session already exists for this course.' });
        }

        const attendance = await prisma.attendance.create({
            data: {
                courseId,
                teacherId,
                date,
                duration,
                isActive: true,
            },
        });
        res.status(201).json(attendance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

  
// Toggle attendance session status
router.patch('/attendance/:id/status',authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    try {
        const session = await prisma.attendance.findUnique({ where: { id: parseInt(id) } });
        if (!session) {
            return res.status(404).json({ error: 'Attendance session not found.' });
        }

        const updatedAttendance = await prisma.attendance.update({
            where: { id: parseInt(id) },
            data: { isActive },
        });
        res.json(updatedAttendance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Teacher deletes a specific attendance session
router.delete('/attendance/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { teacherId } = req.body;
    try {
        const session = await prisma.attendance.findUnique({ where: { id: parseInt(id) } });
        if (!session) {
            return res.status(404).json({ error: 'Attendance session not found.' });
        }
        if (session.teacherId !== teacherId) {
            return res.status(403).json({ error: 'Unauthorized action.' });
        }

        await prisma.attendanceResponse.deleteMany({ where: { attendanceId: parseInt(id) } });
        await prisma.attendance.delete({ where: { id: parseInt(id) } });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Get all attendance records for a course
router.get('/courses/:courseId/attendance', async (req, res) => {
    const { courseId } = req.params;
    try {
      const attendanceRecords = await prisma.attendance.findMany({
        where: { courseId: parseInt(courseId) },
        include: { responses: true },
      });
      res.json(attendanceRecords);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
// Get attendance summary
router.get('/attendance/:id/summary', async (req, res) => {
    const { id } = req.params;
    try {
      const attendanceResponses = await prisma.attendanceResponse.findMany({
        where: { attendanceId: parseInt(id) },
        include: { student: true },
      });
      res.json(attendanceResponses);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


// Teacher views attendance records of a specific student in their course
router.get('/courses/:courseId/students/:studentId/attendance', authenticateUser, async (req, res) => {
  const { courseId, studentId } = req.params;
  try {
      const attendanceRecords = await prisma.attendanceResponse.findMany({
          where: {
              studentId: parseInt(studentId),
              attendance: {
                  courseId: parseInt(courseId),
              },
          },
          include: { attendance: true },
      });
      res.json(attendanceRecords);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});
  
  //-------------------------------------STUDENT-------------------------------------

// Student marks attendance
router.post('/attendance/:id/mark', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { studentId } = req.body;
    try {
        const session = await prisma.attendance.findUnique({ where: { id: parseInt(id) } });
        if (!session || !session.isActive) {
            return res.status(400).json({ error: 'Invalid or inactive attendance session.' });
        }

        const existingResponse = await prisma.attendanceResponse.findFirst({
            where: { attendanceId: parseInt(id), studentId },
        });
        if (existingResponse) {
            return res.status(400).json({ error: 'Attendance already marked for this session.' });
        }

        const attendanceResponse = await prisma.attendanceResponse.create({
            data: {
                attendanceId: parseInt(id),
                studentId,
            },
        });
        res.status(201).json(attendanceResponse);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student updates their attendance response
router.patch('/attendance/:id/mark', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { studentId, newTimestamp } = req.body;
    try {
        const attendanceResponse = await prisma.attendanceResponse.findFirst({
            where: { attendanceId: parseInt(id), studentId },
        });
        if (!attendanceResponse) {
            return res.status(404).json({ error: 'Attendance response not found.' });
        }

        const updatedResponse = await prisma.attendanceResponse.update({
            where: { id: attendanceResponse.id },
            data: { timestamp: newTimestamp || new Date() },
        });
        res.json(updatedResponse);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student views their attendance records
router.get('/students/:studentId/attendance', authenticateUser, async (req, res) => {
    const { studentId } = req.params;
    try {
        const attendanceRecords = await prisma.attendanceResponse.findMany({
            where: { studentId: parseInt(studentId) },
            include: { attendance: true },
        });
        res.json(attendanceRecords);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student views attendance for a specific session
router.get('/attendance/:id/student/:studentId', authenticateUser, async (req, res) => {
    const { id, studentId } = req.params;
    try {
        const attendanceResponse = await prisma.attendanceResponse.findFirst({
            where: { attendanceId: parseInt(id), studentId: parseInt(studentId) },
            include: { attendance: true },
        });
        if (!attendanceResponse) {
            return res.status(404).json({ error: 'Attendance record not found.' });
        }
        res.json(attendanceResponse);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student views attendance for a specific subject
router.get('/students/:studentId/courses/:courseId/attendance', authenticateUser, async (req, res) => {
    const { studentId, courseId } = req.params;
    try {
        const attendanceRecords = await prisma.attendanceResponse.findMany({
            where: {
                studentId: parseInt(studentId),
                attendance: {
                    courseId: parseInt(courseId),
                },
            },
            include: { attendance: true },
        });
        res.json(attendanceRecords);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


  //-------------------------------------ADMIN-------------------------------------

  //get all attendance records
router.get('/attendance', async (req, res) => {
    try {
      const sessions = await prisma.attendance.findMany();
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  

export default router;