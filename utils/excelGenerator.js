import ExcelJS from 'exceljs';

export async function generateAttendanceExcel({
  enrolledStudents,
  course,
  month,
  year,
  session,
  semester,
  startDate,
  endDate,
  attendanceMap,
  months
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendance');

  // Styling
  worksheet.getRow(1).height = 30;
  worksheet.getRow(2).height = 25;
  worksheet.mergeCells('A1:AH1');
  worksheet.mergeCells('A2:AH2');

  // Headers
  worksheet.getCell('A1').value = 'Shri G. S. Institute of Tech. and Science';
  worksheet.getCell('A2').value = 
    `Attendance record for ${months[parseInt(month) - 1]} - ${semester} - ${session}`;

  // Style the headers
  ['A1', 'A2'].forEach(cell => {
    worksheet.getCell(cell).alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };
    worksheet.getCell(cell).font = {
      bold: true,
      size: cell === 'A1' ? 16 : 14
    };
  });

  // Column headers
  worksheet.getRow(3).values = [
    'Enrollment Number',
    'Name',
    ...Array.from({ length: endDate.getDate() }, (_, i) => i + 1),
    'Percentage'
  ];

  // Data rows
  Array.from(attendanceMap.values()).forEach((student, index) => {
    const row = worksheet.getRow(index + 4);
    row.values = [
      student.enrollmentNumber,
      student.name
    ];

    // Fill attendance data
    for (let day = 1; day <= endDate.getDate(); day++) {
      row.getCell(day + 2).value = student.attendance[day] || 'A';
    }

    // Calculate percentage
    const presentDays = Object.values(student.attendance).filter(v => v === 'P').length;
    const percentage = ((presentDays / endDate.getDate()) * 100).toFixed(2);
    row.getCell(endDate.getDate() + 3).value = `${percentage}%`;
  });

  return workbook;
} 