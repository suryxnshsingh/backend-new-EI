import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middlewares/auth.js';
import ExcelJS from 'exceljs';

const router = express.Router();
const prisma = new PrismaClient();

//-------------------------------------REPORTS-------------------------------------
router.get('/attendance/monthly-report/:courseId', authenticateUser, async (req, res) => {
  console.log('Monthly Report Route Hit:', {
    method: req.method,
    fullUrl: req.originalUrl,
    courseId: req.params.courseId,
    query: req.query,
    headers: req.headers
  });

  const { courseId } = req.params;
  const { month, year, session, semester } = req.query;
  
  try {
    // Add validation
    if (!courseId || !month || !year || !session || !semester) {
      console.log('Missing parameters:', { courseId, month, year, session, semester });
      return res.status(400).json({ 
        error: 'Missing required parameters',
        received: { courseId, month, year, session, semester }
      });
    }

    // Get all enrolled students
    const enrolledStudents = await prisma.enrollment.findMany({
      where: {
        courseId: parseInt(courseId),
        status: 'ACCEPTED'
      },
      include: {
        student: true
      }
    });

    // Get course details
    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId) }
    });

    // Get all attendance sessions for the specified month
    const startDate = new Date(year, parseInt(month) - 1, 1);
    const endDate = new Date(year, parseInt(month), 0);

    const attendanceSessions = await prisma.attendance.findMany({
      where: {
        courseId: parseInt(courseId),
        date: {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0]
        }
      },
      include: {
        responses: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    if (attendanceSessions.length === 0) {
      return res.status(404).json({ error: 'No attendance sessions found for this month' });
    }

    // Get array of days when sessions were created with full dates
    const sessionDates = attendanceSessions.map(session => ({
      day: new Date(session.date).getDate(),
      fullDate: new Date(session.date).toLocaleDateString('en-GB') // DD/MM/YYYY format
    }));

    // Create attendance map
    const attendanceMap = new Map();
    enrolledStudents.forEach(enrollment => {
      attendanceMap.set(enrollment.student.id, {
        enrollmentNumber: enrollment.student.enrollmentNumber || 'N/A',
        name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        attendance: {}
      });
    });

    // Fill attendance data
    attendanceSessions.forEach(session => {
      const day = new Date(session.date).getDate();
      // Initialize all students as absent for this day
      enrolledStudents.forEach(enrollment => {
        attendanceMap.get(enrollment.student.id).attendance[day] = 'A';
      });
      // Mark present students
      session.responses.forEach(response => {
        if (attendanceMap.has(response.studentId)) {
          attendanceMap.get(response.studentId).attendance[day] = 'P';
        }
      });
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance');

    // Set column widths
    worksheet.getColumn('A').width = 20; // Enrollment Number column
    worksheet.getColumn('B').width = 30; // Name column

    // Styling
    worksheet.getRow(1).height = 30;
    worksheet.getRow(2).height = 25;
    worksheet.mergeCells('A1:AH1');
    worksheet.mergeCells('A2:AH2');

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Headers
    worksheet.getCell('A1').value = 'Department of Electronics and Instrumentation - Shri G. S. Institute of Tech. and Science';
    worksheet.getCell('A2').value = 
      `Attendance record for ${months[parseInt(month) - 1]} - Semester ${semester} - Session ${session}`;

    ['A1', 'A2'].forEach(cell => {
      worksheet.getCell(cell).alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell(cell).font = { bold: true, size: cell === 'A1' ? 16 : 14 };
    });

    // Column headers - use full dates
    worksheet.getRow(3).values = [
      'Enrollment Number',
      'Name',
      ...sessionDates.map(date => date.fullDate),
      'Percentage'
    ];

    // Data rows - Sort by enrollment number before creating rows
    Array.from(attendanceMap.values())
      .sort((a, b) => {
        // Handle 'N/A' cases
        if (a.enrollmentNumber === 'N/A') return 1;
        if (b.enrollmentNumber === 'N/A') return -1;
        return a.enrollmentNumber.localeCompare(b.enrollmentNumber, undefined, { numeric: true });
      })
      .forEach((student, index) => {
        const row = worksheet.getRow(index + 4);
        row.values = [student.enrollmentNumber, student.name];

        // Fill attendance data using day numbers from the dates
        sessionDates.forEach((date, dayIndex) => {
          row.getCell(dayIndex + 3).value = student.attendance[date.day] || 'A';
        });

        // Calculate percentage based on actual session days
        const presentDays = sessionDates.filter(date => student.attendance[date.day] === 'P').length;
        const percentage = ((presentDays / sessionDates.length) * 100).toFixed(2);
        row.getCell(sessionDates.length + 3).value = `${percentage}%`;
      });

    // Adjust column widths for date columns
    sessionDates.forEach((_, index) => {
      worksheet.getColumn(index + 3).width = 12; // Width for date columns
    });

    // Generate buffer and send response
    const buffer = await workbook.xlsx.writeBuffer();

    console.log('Sending Excel file:', {
      filename: `attendance_${course.courseCode}_${months[parseInt(month) - 1]}_${year}.xlsx`,
      size: buffer.length
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename=attendance_${course.courseCode}_${months[parseInt(month) - 1]}_${year}.xlsx`
    );

    // Send the file
    return res.send(buffer);

  } catch (err) {
    console.error('Error in monthly report:', err);
    return res.status(500).json({ error: err.message });
  }
});

//-------------------------------------TEACHER-------------------------------------


// Teacher creates attendance Session for a course    (frontend done)
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


// Toggle attendance session status    (frontend done)
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


// Teacher deletes a specific attendance session      (frontend done)
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


// Get all attendance sessions for a course
router.get('/courses/:courseId/attendance', authenticateUser, async (req, res) => {
  const { courseId } = req.params;
  try {
    console.log('Fetching attendance sessions for course:', courseId);
    const attendanceSessions = await prisma.attendance.findMany({
      where: { 
        courseId: parseInt(courseId)
      },
      orderBy: {
        date: 'desc'
      }
    });
    console.log('Found sessions:', attendanceSessions.length);
    res.json(attendanceSessions);
  } catch (err) {
    console.error('Error fetching course attendance:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get attendance records for a specific student in a course
router.get('/courses/:courseId/students/:studentId/attendance', authenticateUser, async (req, res) => {
  const { courseId, studentId } = req.params;
  try {
    console.log('Fetching attendance for student:', { studentId, courseId });

    // First verify the student exists and is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: parseInt(studentId),
        courseId: parseInt(courseId),
        status: 'ACCEPTED'
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Student not enrolled in this course' });
    }

    // Get all attendance responses for this student in this course
    const attendanceResponses = await prisma.attendanceResponse.findMany({
      where: {
        studentId: parseInt(studentId),
        attendance: {
          courseId: parseInt(courseId)
        }
      },
      include: {
        attendance: {
          select: {
            id: true,
            date: true,
            courseId: true
          }
        }
      },
      orderBy: {
        'attendance.date': 'desc'
      }
    });

    console.log('Found responses:', attendanceResponses.length);
    res.json(attendanceResponses);
  } catch (err) {
    console.error('Error fetching student attendance:', err);
    return res.status(500).json({ 
      error: 'Failed to fetch attendance records',
      details: err.message 
    });
  }
});


//-------------------------------------STUDENT-------------------------------------

// Student marks attendance     (FE done)
router.post('/attendance/:id/mark', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    try {
        const student = await prisma.student.findUnique({ where: { userId } });
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        const session = await prisma.attendance.findUnique({ where: { id: parseInt(id) } });
        if (!session || !session.isActive) {
            return res.status(400).json({ error: 'Invalid or inactive attendance session.' });
        }

        const existingResponse = await prisma.attendanceResponse.findFirst({
            where: { attendanceId: parseInt(id), studentId: student.id },
        });
        if (existingResponse) {
            return res.status(400).json({ error: 'Attendance already marked for this session.' });
        }

        const attendanceResponse = await prisma.attendanceResponse.create({
            data: {
                attendanceId: parseInt(id),
                studentId: student.id,
            },
        });
        res.status(201).json(attendanceResponse);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student views their attendance records          (FE to do)
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

// Student views attendance for a specific session       (FE to do)
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

// Student views attendance for a specific subject        (FE to do)
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

  //get all attendance records            (to be figured out)
router.get('/attendance', async (req, res) => {
  try {
    const sessions = await prisma.attendance.findMany();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student's attendance summary for a course
router.get('/courses/:courseId/students/:studentId/attendance-summary', authenticateUser, async (req, res) => {
  const { courseId, studentId } = req.params;
  try {
    // First verify the student exists and is enrolled
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: parseInt(studentId),
        courseId: parseInt(courseId),
        status: 'ACCEPTED'
      },
      include: {
        student: true,
        course: true
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Student not enrolled in this course' });
    }

    // Get all attendance sessions for this course
    const attendanceSessions = await prisma.attendance.findMany({
      where: { 
        courseId: parseInt(courseId)
      },
      include: {
        responses: {
          where: {
            studentId: parseInt(studentId)
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Format the response
    const formattedAttendance = attendanceSessions.map(session => ({
      date: new Date(session.date).toLocaleDateString('en-GB'),
      status: session.responses.length > 0 ? 'Present' : 'Absent'
    }));

    // Calculate attendance percentage
    const totalSessions = attendanceSessions.length;
    const presentSessions = attendanceSessions.filter(session => session.responses.length > 0).length;
    const percentage = totalSessions > 0 ? ((presentSessions / totalSessions) * 100).toFixed(2) : 0;

    res.json({
      student: {
        id: enrollment.student.id,
        name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        enrollmentNumber: enrollment.student.enrollmentNumber
      },
      course: {
        id: enrollment.course.id,
        name: enrollment.course.name,
        code: enrollment.course.courseCode
      },
      attendance: formattedAttendance,
      summary: {
        totalSessions,
        presentSessions,
        percentage
      }
    });

  } catch (err) {
    console.error('Error fetching attendance summary:', err);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

// Get attendance summary for a session
router.get('/attendance/:id/summary', authenticateUser, async (req, res) => {
  const { id } = req.params;
  try {
    // Get the attendance session with course info
    const attendanceSession = await prisma.attendance.findUnique({
      where: { id: parseInt(id) },
      include: { course: true }
    });

    if (!attendanceSession) {
      return res.status(404).json({ error: 'Attendance session not found' });
    }

    // Get all enrolled students for the course
    const enrolledStudents = await prisma.enrollment.findMany({
      where: {
        courseId: attendanceSession.courseId,
        status: 'ACCEPTED'
      },
      include: {
        student: true
      }
    });

    // Get attendance responses for this session
    const attendanceResponses = await prisma.attendanceResponse.findMany({
      where: { attendanceId: parseInt(id) },
      include: { student: true }
    });

    // Create a map of students who marked attendance
    const presentStudents = new Map(
      attendanceResponses.map(response => [response.studentId, response])
    );

    // Combine the data and format response
    const formattedResponses = enrolledStudents
      .map(enrollment => ({
        id: enrollment.student.id,
        enrollmentNumber: enrollment.student.enrollmentNumber || 'N/A',
        firstName: enrollment.student.firstName,
        lastName: enrollment.student.lastName,
        status: presentStudents.has(enrollment.student.id) ? 'Present' : 'Absent',
        timestamp: presentStudents.get(enrollment.student.id)?.timestamp || null
      }))
      .sort((a, b) => {
        // Sort by status (Present first) then by enrollment number
        if (a.status !== b.status) {
          return a.status === 'Present' ? -1 : 1;
        }
        return (a.enrollmentNumber || '').localeCompare(b.enrollmentNumber || '');
      });

    res.json(formattedResponses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;