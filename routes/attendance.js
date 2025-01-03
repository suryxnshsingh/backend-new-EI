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
        // Get all attendance sessions for this course
        const allSessions = await prisma.attendance.findMany({
            where: {
                courseId: parseInt(courseId),
                isActive: false // Only get completed sessions
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

        // Format the response to include attendance status
        const formattedSessions = allSessions.map(session => ({
            id: session.id,
            date: session.date,
            status: session.responses.length > 0 ? 'Present' : 'Absent',
            courseName: session.courseName,
            courseCode: session.courseCode
        }));

        res.json(formattedSessions);
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

// Get all attendance history for a student
router.get('/students/:studentId/attendance-history', authenticateUser, async (req, res) => {
    const { studentId } = req.params;
    console.log('Fetching attendance history for student:', studentId);
    
    try {
        // 1. First verify the student exists
        const student = await prisma.student.findFirst({
            where: { userId: parseInt(studentId) }
        });

        if (!student) {
            console.log('Student not found for userId:', studentId);
            return res.status(404).json({ error: 'Student not found' });
        }

        console.log('Found student:', student.id);

        // 2. Get all courses the student is enrolled in
        const enrollments = await prisma.enrollment.findMany({
            where: {
                studentId: student.id,
                status: 'ACCEPTED'
            },
            include: {
                course: true
            }
        });
        
        console.log('Enrollments:', {
            count: enrollments.length,
            courses: enrollments.map(e => ({
                id: e.courseId,
                name: e.course.name,
                code: e.course.courseCode
            }))
        });

        if (enrollments.length === 0) {
            return res.json([]);
        }

        // 3. Get all attendance sessions from these courses
        const attendanceSessions = await prisma.attendance.findMany({
            where: {
                courseId: {
                    in: enrollments.map(e => e.courseId)
                },
                isActive: false
            },
            include: {
                course: true
            }
        });

        console.log('Attendance sessions found:', attendanceSessions.length);

        if (attendanceSessions.length === 0) {
            return res.json([]);
        }

        // 4. Get student's responses for these sessions
        const responses = await prisma.attendanceResponse.findMany({
            where: {
                studentId: student.id,
                attendanceId: {
                    in: attendanceSessions.map(s => s.id)
                }
            }
        });

        console.log('Student responses found:', responses.length);

        // 5. Create a map of responses for quick lookup
        const responseMap = new Map(
            responses.map(r => [r.attendanceId, r])
        );

        // 6. Format all sessions with present/absent status
        const formattedRecords = attendanceSessions.map(session => ({
            date: session.date,
            courseName: session.course.name,
            courseCode: session.course.courseCode,
            status: responseMap.has(session.id) ? 'Present' : 'Absent'
        }));

        console.log('Final formatted records:', {
            total: formattedRecords.length,
            present: formattedRecords.filter(r => r.status === 'Present').length,
            absent: formattedRecords.filter(r => r.status === 'Absent').length
        });

        res.json(formattedRecords);
    } catch (err) {
        console.error('Error in attendance history:', err);
        res.status(500).json({ error: 'Failed to fetch attendance history' });
    }
});

// DEBUG route - remove in production
router.get('/debug/student/:studentId', authenticateUser, async (req, res) => {
    const { studentId } = req.params;
    try {
        const debug = {
            enrollments: await prisma.enrollment.findMany({
                where: { studentId: parseInt(studentId) }
            }),
            attendanceSessions: await prisma.attendance.findMany({
                where: { 
                    courseId: {
                        in: (await prisma.enrollment.findMany({
                            where: { studentId: parseInt(studentId) }
                        })).map(e => e.courseId)
                    }
                }
            }),
            responses: await prisma.attendanceResponse.findMany({
                where: { studentId: parseInt(studentId) }
            })
        };
        res.json(debug);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add this route to your attendance.js
router.get('/student-monthly-report', authenticateUser, async (req, res) => {
  try {
    const { session, semester, month, year } = req.query;
    
    console.log('Auth user:', req.user);

    // First get the user's student profile
    const student = await prisma.student.findFirst({
      where: {
        user: {
          id: req.user.userId
        }
      },
      include: {
        user: true,
        enrollments: {
          where: {
            status: 'ACCEPTED',
            course: {
              session: session,
              semester: semester.toString()
            }
          },
          include: {
            course: true
          }
        }
      }
    });

    if (!student) {
      console.log('Student not found for userId:', req.user.userId);
      throw new Error(`Student not found for user ID ${req.user.userId}`);
    }

    console.log('Found student:', {
      id: student.id,
      userId: student.user.id,
      name: `${student.user.firstName} ${student.user.lastName}`,
      enrollmentNumber: student.enrollmentNumber,
      enrollments: student.enrollments.map(e => ({
        courseId: e.courseId,
        courseName: e.course.name,
        courseCode: e.course.courseCode
      }))
    });

    // 2. Calculate date range
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum - 1, daysInMonth);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    console.log('Date range:', { startDate, endDate });

    // 3. Get all attendance sessions first
    const attendanceSessions = await prisma.attendance.findMany({
      where: {
        courseId: {
          in: student.enrollments.map(e => e.courseId)
        },
        date: {
          gte: startDate.toISOString(),
          lte: endDate.toISOString()
        },
        isActive: false
      },
      include: {
        responses: {
          where: {
            studentId: student.id
          }
        },
        course: true
      }
    });

    console.log('Found attendance sessions:', attendanceSessions.length);

    // 4. Process attendance data
    const courseAttendance = new Map();
    
    attendanceSessions.forEach(session => {
      if (!courseAttendance.has(session.courseId)) {
        courseAttendance.set(session.courseId, {
          courseCode: session.course.courseCode,
          courseName: session.course.name,
          sessions: [],
          totalSessions: 0,
          presentCount: 0
        });
      }

      const courseData = courseAttendance.get(session.courseId);
      courseData.totalSessions++;
      const isPresent = session.responses.length > 0;
      if (isPresent) courseData.presentCount++;

      // Convert string date to Date object before getting date
      const sessionDate = new Date(session.date);
      courseData.sessions.push({
        date: sessionDate.getDate(),
        status: isPresent ? 'P' : 'A'
      });

      console.log('Processed session:', {
        courseCode: session.course.courseCode,
        date: sessionDate,
        dayOfMonth: sessionDate.getDate(),
        isPresent
      });
    });

    // 5. Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // 6. Set up columns with proper date formatting
    const dateColumns = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(yearNum, monthNum - 1, i + 1);
      return {
        header: `${String(i + 1).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}/${yearNum}`,
        key: `day${i + 1}`,
        width: 12
      };
    });

    worksheet.columns = [
      { header: 'Subject Code', key: 'code', width: 15 },
      { header: 'Name of Subject', key: 'name', width: 30 },
      ...dateColumns,
      { header: 'Percentage', key: 'percentage', width: 12 }
    ];

    // 7. Add headers
    worksheet.mergeCells('A1:' + worksheet.getColumn(worksheet.columnCount).letter + '1');
    const instituteCell = worksheet.getCell('A1');
    instituteCell.value = 'Department of Electronics and Instrumentation - Shri G. S. Institute of Tech. and Science';
    instituteCell.alignment = { horizontal: 'center' };
    instituteCell.font = { bold: true, size: 14 };

    worksheet.mergeCells('A2:' + worksheet.getColumn(worksheet.columnCount).letter + '2');
    const studentCell = worksheet.getCell('A2');
    studentCell.value = `Attendance record for ${student.enrollmentNumber} - ${student.user.firstName} ${student.user.lastName} - ${
      new Date(yearNum, monthNum - 1).toLocaleString('default', { month: 'long' })} - Semester ${semester} - Session ${session}`;
    studentCell.alignment = { horizontal: 'center' };
    studentCell.font = { bold: true };

    // Style the column headers (row 3)
    const headerRow = worksheet.getRow(3);
    headerRow.values = [
      'Subject Code',
      'Name of Subject',
      ...Array.from({ length: daysInMonth }, (_, i) => 
        `${String(i + 1).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}/${yearNum}`
      ),
      'Percentage'
    ];
    
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Rotate and style date headers
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber > 2 && colNumber < worksheet.columnCount) {  // Skip first two columns and percentage column
        cell.alignment = { 
          horizontal: 'center', 
          vertical: 'middle',
          textRotation: 45  // Rotate text 45 degrees
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }  // Light gray background
        };
      }
    });

    // 8. Add data rows
    let totalPercentage = 0;
    let courseCount = 0;

    for (const [_, data] of courseAttendance) {
      courseCount++;
      const percentage = data.totalSessions > 0 
        ? ((data.presentCount / data.totalSessions) * 100).toFixed(2)
        : '0.00';
      totalPercentage += parseFloat(percentage);

      const rowData = {
        code: data.courseCode,
        name: data.courseName,
        percentage: `${percentage}%`
      };

      // Fill in attendance for each day
      for (let day = 1; day <= daysInMonth; day++) {
        const sessionForDay = data.sessions.find(s => s.date === day);
        rowData[`day${day}`] = sessionForDay ? sessionForDay.status : '-';
      }

      worksheet.addRow(rowData);
    }

    // 9. Add average row if there are courses
    if (courseCount > 0) {
      const averageRow = worksheet.addRow({
        code: '',
        name: 'Average Percentage',
        percentage: `${(totalPercentage / courseCount).toFixed(2)}%`
      });
      averageRow.font = { bold: true };
    }

    // 10. Style the worksheet
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.alignment = { horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // 11. Send the file
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${session}_sem${semester}_${month}.xlsx`);
    res.send(buffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: error.message
    });
  }
});

// Helper array for month names
const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Add this route to your attendance.js
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;