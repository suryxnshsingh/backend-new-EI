const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();

router.use(express.json());

const prisma = new PrismaClient();


// Route to post Exam CO schema
router.post('/co-form', async (req, res) => {
  const { subjectCode, mst1, mst2, quizAssignment } = req.body;

  try {
    const newCO = await prisma.cO.upsert({
      where: { subjectCode },
      update: {
        MST1_Q1: mst1.Q1,
        MST1_Q2: mst1.Q2,
        MST1_Q3: mst1.Q3,
        MST2_Q1: mst2.Q1,
        MST2_Q2: mst2.Q2,
        MST2_Q3: mst2.Q3,
        Quiz_Assignment: quizAssignment,
      },
      create: {
        subjectCode,
        MST1_Q1: mst1.Q1,
        MST1_Q2: mst1.Q2,
        MST1_Q3: mst1.Q3,
        MST2_Q1: mst2.Q1,
        MST2_Q2: mst2.Q2,
        MST2_Q3: mst2.Q3,
        Quiz_Assignment: quizAssignment,
      },
    });

    res.status(201).json(newCO);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit the form' });
  }
});

// Route to create a new sheet entry
router.post('/submit-form', async (req, res) => {
  const { 
    id, 
    name, 
    subjectCode, 
    MST1_Q1, 
    MST1_Q2, 
    MST1_Q3, 
    MST2_Q1, 
    MST2_Q2, 
    MST2_Q3, 
    Quiz_Assignment, 
    EndSem_Q1, 
    EndSem_Q2, 
    EndSem_Q3, 
    EndSem_Q4, 
    EndSem_Q5 
  } = req.body;

  try {
    // Find the teacher based on subjectCode
    const subject = await prisma.subject.findUnique({
      where: {
        code: subjectCode,
      },
      include: {
        teacher: true, // Include the teacher data in the result
      },
    });

    if (!subject || !subject.teacher) {
      return res.status(404).json({ error: 'Subject or Teacher not found' });
    }

    // Create the new sheet and connect it with the subject and teacher
    await prisma.sheet.create({
      data: {
        id,
        name,
        subjectCode,
        teacherId: subject.teacher.id, // Dynamically connect teacher through subjectCode
        MST1_Q1: parseInt(MST1_Q1),
        MST1_Q2: parseInt(MST1_Q2),
        MST1_Q3: parseInt(MST1_Q3),
        MST2_Q1: parseInt(MST2_Q1),
        MST2_Q2: parseInt(MST2_Q2),
        MST2_Q3: parseInt(MST2_Q3),
        EndSem_Q1: parseInt(EndSem_Q1),
        EndSem_Q2: parseInt(EndSem_Q2),
        EndSem_Q3: parseInt(EndSem_Q3),
        EndSem_Q4: parseInt(EndSem_Q4),
        EndSem_Q5: parseInt(EndSem_Q5),
        Quiz_Assignment: parseInt(Quiz_Assignment)
      },
    });

    res.status(201).json({ message: 'Form data saved successfully' });
  } catch (error) {
    console.error('Error saving form data:', error);
    res.status(500).json({ error: 'Error saving form data' });
  }
});

// Route to get all rows from the Sheet table with a specific subjectCode
router.get('/sheets', async (req, res) => {
  const { subjectCode } = req.query; // Retrieve subjectCode from query parameter

  try {
    const sheets = await prisma.sheet.findMany({
      where: {
        subjectCode: subjectCode, // Filter records based on subjectCode
      },
    });
    res.status(200).json(sheets);
  } catch (error) {
    console.error('Error fetching sheets:', error);
    res.status(500).json({ error: 'Error fetching sheets' });
  }
});

// Route to update a specific sheet entry by ID and subjectCode
router.put('/sheets/:id/:subjectCode', async (req, res) => {
  const { id, subjectCode } = req.params;
  const {         
    name,
    MST1_Q1,
    MST1_Q2,
    MST1_Q3,
    MST2_Q1,
    MST2_Q2,
    MST2_Q3,
    Quiz_Assignment,
    EndSem_Q1,
    EndSem_Q2,
    EndSem_Q3,
    EndSem_Q4,
    EndSem_Q5 
  } = req.body;

  try {
    const updatedSheet = await prisma.sheet.update({
      where: {
        id_subjectCode: {
          id: id,
          subjectCode: subjectCode,
        },
      },
      data: {
        name,
        MST1_Q1,
        MST1_Q2,
        MST1_Q3,
        MST2_Q1,
        MST2_Q2,
        MST2_Q3,
        Quiz_Assignment,
        EndSem_Q1,
        EndSem_Q2,
        EndSem_Q3,
        EndSem_Q4,
        EndSem_Q5
      },
    });

    res.status(200).json(updatedSheet);
  } catch (error) {
    console.error('Error updating sheet:', error);
    res.status(500).json({ error: 'Error updating sheet' });
  }
});

const ExcelJS = require('exceljs');


router.get('/downloadmst1/:subjectCode', async (req, res) => {
  const { subjectCode } = req.params;

  try {
    // Fetch CO mappings from the CO table
    const coData = await prisma.cO.findUnique({
      where: { subjectCode },
    });

    if (!coData) {
      return res.status(404).json({ error: 'CO mapping not found for this subject' });
    }

    // Fetch student scores from the Sheet table
    const studentScores = await prisma.sheet.findMany({
      where: { subjectCode },
    });

    if (studentScores.length === 0) {
      return res.status(404).json({ error: 'No student scores found for this subject' });
    }

    // Create a new Excel workbook and sheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('CO Attainment');

    // Set column widths and headers
    worksheet.columns = [
      { header: 'Enrollment Number', key: 'enrollment', width: 20 },
      { header: 'Name', key: 'name', width: 30 },
      { header: `Q1-${coData.MST1_Q1}`, key: 'q1', width: 15 },
      { header: `Q2-${coData.MST1_Q2}`, key: 'q2', width: 15 },
      { header: `Q3-${coData.MST1_Q3}`, key: 'q3', width: 15 },
      { header: 'Total CO1', key: 'totalCO1', width: 15 },
      { header: 'Total CO2', key: 'totalCO2', width: 15 },
      { header: 'Total CO3', key: 'totalCO3', width: 15 },
      { header: 'Total CO4', key: 'totalCO4', width: 15 },
      { header: 'Total CO5', key: 'totalCO5', width: 15 }
    ];

  // Function to calculate CO totals for a student
    const calculateCOTotals = (student) => {
      const totals = {
        totalCO1: 0,
        totalCO2: 0,
        totalCO3: 0,
        totalCO4: 0,
        totalCO5: 0
      };

      // Function to add score to appropriate CO total
      const addScoreToCO = (coMapping, score) => {
        switch (coMapping) {
          case 'CO1': totals.totalCO1 += score || 0; break;
          case 'CO2': totals.totalCO2 += score || 0; break;
          case 'CO3': totals.totalCO3 += score || 0; break;
          case 'CO4': totals.totalCO4 += score || 0; break;
          case 'CO5': totals.totalCO5 += score || 0; break;
        }
      };

      // Map scores to their respective COs
      addScoreToCO(coData.MST1_Q1, student.MST1_Q1);
      addScoreToCO(coData.MST1_Q2, student.MST1_Q2);
      addScoreToCO(coData.MST1_Q3, student.MST1_Q3);

      return totals;
    };

    // Initialize grand totals for all COs
    const grandTotals = {
      totalCO1: 0,
      totalCO2: 0,
      totalCO3: 0,
      totalCO4: 0,
      totalCO5: 0
    };

    // Add rows for each student with their scores
    studentScores.forEach((student) => {
      const coTotals = calculateCOTotals(student);
      
      // Add to grand totals
      Object.keys(grandTotals).forEach(key => {
        grandTotals[key] += coTotals[key];
      });

      worksheet.addRow({
        enrollment: student.id,
        name: student.name,
        q1: student.MST1_Q1 || 0,
        q2: student.MST1_Q2 || 0,
        q3: student.MST1_Q3 || 0,
        ...coTotals
      });
    });

    const studentCount = studentScores.length;
    
    // Calculate averages for all COs
    const averages = {};
    Object.keys(grandTotals).forEach(key => {
      averages[key] = grandTotals[key] / studentCount;
    });

    // Add a row for average (target marks)
    const targetRow = worksheet.addRow({
      enrollment: 'Average (Target Marks)',
      ...averages
    });
    targetRow.font = { bold: true };
    targetRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD700' } // Light gold background
    };

    // Count students who achieved >= target marks for each CO
    const studentsAboveTarget = {
      totalCO1: 0,
      totalCO2: 0,
      totalCO3: 0,
      totalCO4: 0,
      totalCO5: 0
    };

    studentScores.forEach(student => {
      const coTotals = calculateCOTotals(student);
      Object.keys(studentsAboveTarget).forEach(key => {
        if (coTotals[key] >= averages[key]) {
          studentsAboveTarget[key]++;
        }
      });
    });

    // Add a row for students above target marks
    worksheet.addRow({
      enrollment: 'Students >= Target Marks',
      ...studentsAboveTarget
    });

    // Calculate percentages for all COs
    const percentages = {};
    Object.keys(studentsAboveTarget).forEach(key => {
      percentages[key] = `${((studentsAboveTarget[key] / studentCount) * 100).toFixed(2)}%`;
    });

    // Add a row for percentages
    worksheet.addRow({
      enrollment: 'Percentage',
      ...percentages
    });

    // Calculate CO levels based on percentages
    const calculateCOLevel = (percentage) => {
      const numericPercentage = parseFloat(percentage);
      if (numericPercentage >= 70) return 3;
      if (numericPercentage >= 60) return 2;
      if (numericPercentage >= 50) return 1;
      return 0;
    };

    const coLevels = {};
    Object.keys(percentages).forEach(key => {
      coLevels[key] = calculateCOLevel(percentages[key]);
    });

    // Add CO Level row
    const coLevelRow = worksheet.addRow({
      enrollment: 'CO Level',
      ...coLevels
    });
    coLevelRow.font = { bold: true };
    coLevelRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF98FB98' } // Light green background
    };

    // Prepare the response with the generated Excel file
    const fileName = `CO_Attainment_${subjectCode}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Write the workbook to the response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate the Excel sheet' });
  }
});


router.get('/downloadmst2/:subjectCode', async (req, res) => {
  const { subjectCode } = req.params;

  try {
    // Fetch CO mappings from the CO table
    const coData = await prisma.cO.findUnique({
      where: { subjectCode },
    });

    if (!coData) {
      return res.status(404).json({ error: 'CO mapping not found for this subject' });
    }

    // Fetch student scores from the Sheet table
    const studentScores = await prisma.sheet.findMany({
      where: { subjectCode },
    });

    if (studentScores.length === 0) {
      return res.status(404).json({ error: 'No student scores found for this subject' });
    }

    // Create a new Excel workbook and sheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('CO Attainment');

    // Set column widths and headers
    worksheet.columns = [
      { header: 'Enrollment Number', key: 'enrollment', width: 20 },
      { header: 'Name', key: 'name', width: 30 },
      { header: `Q1-${coData.MST2_Q1}`, key: 'q1', width: 15 },
      { header: `Q2-${coData.MST2_Q2}`, key: 'q2', width: 15 },
      { header: `Q3-${coData.MST2_Q3}`, key: 'q3', width: 15 },
      { header: 'Total CO1', key: 'totalCO1', width: 15 },
      { header: 'Total CO2', key: 'totalCO2', width: 15 },
      { header: 'Total CO3', key: 'totalCO3', width: 15 },
      { header: 'Total CO4', key: 'totalCO4', width: 15 },
      { header: 'Total CO5', key: 'totalCO5', width: 15 }
    ];

  // Function to calculate CO totals for a student
    const calculateCOTotals = (student) => {
      const totals = {
        totalCO1: 0,
        totalCO2: 0,
        totalCO3: 0,
        totalCO4: 0,
        totalCO5: 0
      };

      const addScoreToCO = (coMapping, score) => {
        switch (coMapping) {
          case 'CO1': totals.totalCO1 += score || 0; break;
          case 'CO2': totals.totalCO2 += score || 0; break;
          case 'CO3': totals.totalCO3 += score || 0; break;
          case 'CO4': totals.totalCO4 += score || 0; break;
          case 'CO5': totals.totalCO5 += score || 0; break;
        }
      };

      // Map scores to their respective COs
      addScoreToCO(coData.MST2_Q1, student.MST2_Q1);
      addScoreToCO(coData.MST2_Q2, student.MST2_Q2);
      addScoreToCO(coData.MST2_Q3, student.MST2_Q3);

      return totals;
    };

    // Initialize grand totals for all COs
    const grandTotals = {
      totalCO1: 0,
      totalCO2: 0,
      totalCO3: 0,
      totalCO4: 0,
      totalCO5: 0
    };

    // Add rows for each student with their scores
    studentScores.forEach((student) => {
      const coTotals = calculateCOTotals(student);
      
      // Add to grand totals
      Object.keys(grandTotals).forEach(key => {
        grandTotals[key] += coTotals[key];
      });

      worksheet.addRow({
        enrollment: student.id,
        name: student.name,
        q1: student.MST2_Q1 || 0,
        q2: student.MST2_Q2 || 0,
        q3: student.MST2_Q3 || 0,
        ...coTotals
      });
    });

    const studentCount = studentScores.length;
    
    // Calculate averages for all COs
    const averages = {};
    Object.keys(grandTotals).forEach(key => {
      averages[key] = grandTotals[key] / studentCount;
    });

    // Add a row for average (target marks)
    const targetRow = worksheet.addRow({
      enrollment: 'Average (Target Marks)',
      ...averages
    });
    targetRow.font = { bold: true };
    targetRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD700' } // Light gold background
    };

    // Count students who achieved >= target marks for each CO
    const studentsAboveTarget = {
      totalCO1: 0,
      totalCO2: 0,
      totalCO3: 0,
      totalCO4: 0,
      totalCO5: 0
    };

    studentScores.forEach(student => {
      const coTotals = calculateCOTotals(student);
      Object.keys(studentsAboveTarget).forEach(key => {
        if (coTotals[key] >= averages[key]) {
          studentsAboveTarget[key]++;
        }
      });
    });

    // Add a row for students above target marks
    worksheet.addRow({
      enrollment: 'Students >= Target Marks',
      ...studentsAboveTarget
    });

    // Calculate percentages for all COs
    const percentages = {};
    Object.keys(studentsAboveTarget).forEach(key => {
      percentages[key] = `${((studentsAboveTarget[key] / studentCount) * 100).toFixed(2)}%`;
    });

    // Add a row for percentages
    worksheet.addRow({
      enrollment: 'Percentage',
      ...percentages
    });

    // Calculate CO levels based on percentages
    const calculateCOLevel = (percentage) => {
      const numericPercentage = parseFloat(percentage);
      if (numericPercentage >= 70) return 3;
      if (numericPercentage >= 60) return 2;
      if (numericPercentage >= 50) return 1;
      return 0;
    };

    const coLevels = {};
    Object.keys(percentages).forEach(key => {
      coLevels[key] = calculateCOLevel(percentages[key]);
    });

    // Add CO Level row
    const coLevelRow = worksheet.addRow({
      enrollment: 'CO Level',
      ...coLevels
    });
    coLevelRow.font = { bold: true };
    coLevelRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF98FB98' } // Light green background
    };

    // Prepare the response with the generated Excel file
    const fileName = `CO_Attainment_${subjectCode}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Write the workbook to the response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate the Excel sheet' });
  }
});

// Route to download an Excel sheet with calculations and averages
router.get('/download-sheets', async (req, res) => {
  const { subjectCode } = req.query; // Get subjectCode from query parameter

  try {
    // Fetch the subject details
    const subject = await prisma.subject.findUnique({
      where: { code: subjectCode },
    });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    // Fetch the sheets for the specified subjectCode
    const sheets = await prisma.sheet.findMany({
      where: {
        subjectCode: subjectCode,
      },
    });

    if (sheets.length === 0) {
      return res.status(404).json({ error: 'No sheets found for this subject code.' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet Data');

    // Add header rows
    worksheet.addRow(['Shri G. S. Institute of Tech. and Science']);
    worksheet.addRow(['Department of Electronics and Instrumentation Engineering']);
    worksheet.addRow([`Course Outcome Sheet for ${subjectCode}-${subject.name}`]);

    // Center align and merge the header rows
    for (let i = 1; i <= 3; i++) {
      worksheet.getRow(i).alignment = { horizontal: 'center' };
      worksheet.mergeCells(`A${i}:S${i}`);
    }

    // Add an empty row for spacing
    worksheet.addRow([]);

    // Add main header row
    worksheet.addRow([
      'Enrollment Number', 'Name', 'Subject Code', 'MST1_Q1', 'MST1_Q2', 'MST1_Q3', 'MST1_Total',
      'MST2_Q1', 'MST2_Q2', 'MST2_Q3', 'MST2_Total', 'MST_Best', 'Quiz/Assignment',
      'EndSem_Q1', 'EndSem_Q2', 'EndSem_Q3', 'EndSem_Q4', 'EndSem_Q5', 'EndSem_Total'
    ]);

    // Style the main header row
    worksheet.getRow(5).font = { bold: true };
    worksheet.getRow(5).alignment = { horizontal: 'center' };

    // Set column widths
    worksheet.columns = [
      { width: 20 }, { width: 30 }, { width: 15 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 15 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 15 },
      { width: 15 }, { width: 20 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 15 }
    ];

    // Add data rows with calculations for MST1_Total, MST2_Total, MST_Best, and EndSem_Total
    sheets.forEach((sheet) => {
      const MST1_Total = (sheet.MST1_Q1 || 0) + (sheet.MST1_Q2 || 0) + (sheet.MST1_Q3 || 0);
      const MST2_Total = (sheet.MST2_Q1 || 0) + (sheet.MST2_Q2 || 0) + (sheet.MST2_Q3 || 0);
      const MST_Best = Math.max(MST1_Total, MST2_Total);
      const EndSem_Total = (sheet.EndSem_Q1 || 0) + (sheet.EndSem_Q2 || 0) + (sheet.EndSem_Q3 || 0) + (sheet.EndSem_Q4 || 0) + (sheet.EndSem_Q5 || 0);

      worksheet.addRow([
        sheet.id, sheet.name, sheet.subjectCode,
        sheet.MST1_Q1, sheet.MST1_Q2, sheet.MST1_Q3, MST1_Total,
        sheet.MST2_Q1, sheet.MST2_Q2, sheet.MST2_Q3, MST2_Total,
        MST_Best, sheet.Quiz_Assignment,
        sheet.EndSem_Q1, sheet.EndSem_Q2, sheet.EndSem_Q3, sheet.EndSem_Q4, sheet.EndSem_Q5, EndSem_Total
      ]);
    });

    // Add the average row at the end of the data
    const lastRowNumber = worksheet.lastRow.number;
    const averageRow = worksheet.addRow(['Average']);
    averageRow.font = { bold: true };

    // Calculate averages for each column
    for (let col = 4; col <= 19; col++) {
      averageRow.getCell(col).value = { formula: `AVERAGE(${String.fromCharCode(64 + col)}6:${String.fromCharCode(64 + col)}${lastRowNumber})` };
    }

    // Set response headers for the download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sheets.xlsx');

    // Write the Excel file to the response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel sheet:', error);
    res.status(500).json({ error: 'Error generating Excel sheet' });
  }
});

// Route to generate and download Excel file for a specific subjectCode
router.get('/end-excel/:subjectCode', async (req, res) => {
  try {
    const { subjectCode } = req.params;

    // Fetch all sheets for the given subject
    const sheets = await prisma.sheet.findMany({
      where: {
        subjectCode: subjectCode
      },
      select: {
        id: true,
        name: true,
        EndSem_Q1: true,
        EndSem_Q2: true,
        EndSem_Q3: true,
        EndSem_Q4: true,
        EndSem_Q5: true,
      }
    });

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Student Marks');

    // Define headers
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'CO1', key: 'co1', width: 10 },
      { header: 'CO2', key: 'co2', width: 10 },
      { header: 'CO3', key: 'co3', width: 10 },
      { header: 'CO4', key: 'co4', width: 10 },
      { header: 'CO5', key: 'co5', width: 10 },
    ];

    // Add data rows
    sheets.forEach(sheet => {
      worksheet.addRow({
        id: sheet.id,
        name: sheet.name,
        co1: sheet.EndSem_Q1 || 0,
        co2: sheet.EndSem_Q2 || 0,
        co3: sheet.EndSem_Q3 || 0,
        co4: sheet.EndSem_Q4 || 0,
        co5: sheet.EndSem_Q5 || 0,
      });
    });

    // Calculate target marks (averages)
    const totalRows = sheets.length;
    const targetMarks = {
      id: 'Target Marks',
      name: '',
      co1: sheets.reduce((sum, sheet) => sum + (sheet.EndSem_Q1 || 0), 0) / totalRows,
      co2: sheets.reduce((sum, sheet) => sum + (sheet.EndSem_Q2 || 0), 0) / totalRows,
      co3: sheets.reduce((sum, sheet) => sum + (sheet.EndSem_Q3 || 0), 0) / totalRows,
      co4: sheets.reduce((sum, sheet) => sum + (sheet.EndSem_Q4 || 0), 0) / totalRows,
      co5: sheets.reduce((sum, sheet) => sum + (sheet.EndSem_Q5 || 0), 0) / totalRows,
    };

    // Calculate CO levels
    const calculateCOLevel = (scores, targetMark) => {
      const totalStudents = scores.length;
      const studentsAboveTarget = scores.filter(score => (score || 0) >= targetMark).length;
      const percentage = (studentsAboveTarget / totalStudents) * 100;

      if (percentage >= 70) return 3;
      if (percentage >= 60) return 2;
      if (percentage >= 50) return 1;
      return 0;
    };

    const coLevels = {
      id: 'CO Level',
      name: '',
      co1: calculateCOLevel(sheets.map(s => s.EndSem_Q1), targetMarks.co1),
      co2: calculateCOLevel(sheets.map(s => s.EndSem_Q2), targetMarks.co2),
      co3: calculateCOLevel(sheets.map(s => s.EndSem_Q3), targetMarks.co3),
      co4: calculateCOLevel(sheets.map(s => s.EndSem_Q4), targetMarks.co4),
      co5: calculateCOLevel(sheets.map(s => s.EndSem_Q5), targetMarks.co5),
    };

    // Add target marks row
    const targetRow = worksheet.addRow(targetMarks);
    targetRow.font = { bold: true };
    targetRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD700' } // Light gold background
    };

    // Add CO level row
    const coLevelRow = worksheet.addRow(coLevels);
    coLevelRow.font = { bold: true };
    coLevelRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF98FB98' } // Light green background
    };

    // Style the headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Set number format for CO columns to show 2 decimal places
    for (let i = 3; i <= 7; i++) {
      worksheet.getColumn(i).numFmt = '0.00';
    }

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=student_marks_${subjectCode}.xlsx`);

    // Send the file
    res.send(buffer);

  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
});

// Helper function to calculate MST scores for a specific CO
const calculateMSTScores = (sheets, coMappings) => {
  const scores = {
    MST1: { CO1: 0, CO2: 0, CO3: 0, CO4: 0, CO5: 0 },
    MST2: { CO1: 0, CO2: 0, CO3: 0, CO4: 0, CO5: 0 }
  };
  
  sheets.forEach(sheet => {
    // MST1
    if (sheet.MST1_Q1) {
      scores.MST1[coMappings.MST1_Q1] = (scores.MST1[coMappings.MST1_Q1] || 0) + sheet.MST1_Q1;
    }
    if (sheet.MST1_Q2) {
      scores.MST1[coMappings.MST1_Q2] = (scores.MST1[coMappings.MST1_Q2] || 0) + sheet.MST1_Q2;
    }
    if (sheet.MST1_Q3) {
      scores.MST1[coMappings.MST1_Q3] = (scores.MST1[coMappings.MST1_Q3] || 0) + sheet.MST1_Q3;
    }
    
    // MST2
    if (sheet.MST2_Q1) {
      scores.MST2[coMappings.MST2_Q1] = (scores.MST2[coMappings.MST2_Q1] || 0) + sheet.MST2_Q1;
    }
    if (sheet.MST2_Q2) {
      scores.MST2[coMappings.MST2_Q2] = (scores.MST2[coMappings.MST2_Q2] || 0) + sheet.MST2_Q2;
    }
    if (sheet.MST2_Q3) {
      scores.MST2[coMappings.MST2_Q3] = (scores.MST2[coMappings.MST2_Q3] || 0) + sheet.MST2_Q3;
    }
  });
  
  return scores;
};

// Helper function to calculate Quiz/Assignment scores
const calculateQuizScores = (sheets, quizCOs) => {
  const scores = { CO1: 0, CO2: 0, CO3: 0, CO4: 0, CO5: 0 };
  
  sheets.forEach(sheet => {
    if (sheet.Quiz_Assignment) {
      const scorePerCO = sheet.Quiz_Assignment / quizCOs.length;
      quizCOs.forEach(co => {
        scores[co] = (scores[co] || 0) + scorePerCO;
      });
    }
  });
  
  return scores;
};

// Helper function to calculate End Semester scores
const calculateEndSemScores = (sheets) => {
  const scores = {
    CO1: 0,
    CO2: 0,
    CO3: 0,
    CO4: 0,
    CO5: 0
  };
  
  sheets.forEach(sheet => {
    if (sheet.EndSem_Q1) scores.CO1 += sheet.EndSem_Q1;
    if (sheet.EndSem_Q2) scores.CO2 += sheet.EndSem_Q2;
    if (sheet.EndSem_Q3) scores.CO3 += sheet.EndSem_Q3;
    if (sheet.EndSem_Q4) scores.CO4 += sheet.EndSem_Q4;
    if (sheet.EndSem_Q5) scores.CO5 += sheet.EndSem_Q5;
  });
  
  return scores;
};

router.get('/generate-co-attainment/:subjectCode', async (req, res) => {
  try {
    const { subjectCode } = req.params;
    
    // Fetch data for specific subject with correct relations
    const subjectData = await prisma.subject.findUnique({
      where: { code: subjectCode },
      include: {
        sheets: true
      }
    });
    
    if (!subjectData) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    // Fetch CO mappings separately
    const coMapping = await prisma.CO.findUnique({
      where: { subjectCode: subjectCode }
    });
    
    if (!coMapping) {
      return res.status(404).json({ error: 'CO mapping not found' });
    }
    
    // Calculate all scores
    const mstScores = calculateMSTScores(subjectData.sheets, coMapping);
    const quizScores = calculateQuizScores(subjectData.sheets, coMapping.Quiz_Assignment);
    const endSemScores = calculateEndSemScores(subjectData.sheets);
    
    const studentCount = subjectData.sheets.length;
    const cos = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'];
    
    // Calculate final scores
    const finalScores = cos.reduce((acc, co) => {
      // Calculate CIE (30% weightage)
      const cieScore = (
        ((mstScores.MST1[co] || 0) + 
         (mstScores.MST2[co] || 0) + 
         (quizScores[co] || 0)) / studentCount
      ) * 0.3;
      
      // Calculate End Sem (70% weightage)
      const endSemScore = (endSemScores[co] || 0) / studentCount * 0.7;
      
      acc[co] = {
        MST1: (mstScores.MST1[co] || 0) / studentCount,
        MST2: (mstScores.MST2[co] || 0) / studentCount,
        Quiz: (quizScores[co] || 0) / studentCount,
        CIE: cieScore,
        EndSem: (endSemScores[co] || 0) / studentCount,
        Final: cieScore + endSemScore
      };
      
      return acc;
    }, {});
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('CO Attainment');
    
    // Updated column widths to accommodate longer content
    worksheet.columns = [
      { width: 12 },  // CO column
      { width: 20 },  // MST-1
      { width: 20 },  // MST-2
      { width: 25 },  // Assignment/Quiz
      { width: 25 },  // CIE
      { width: 30 },  // End Sem Exam
      { width: 30 },  // CO Direct Attainment
    ];
    
    // Add title
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'SGSITS Indore - Overall Direct CO attainment';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };
    
    // Add headers
    const headers = [
      ['', '', '', '', 'Cumulative Internal Evaluation', 'SEE (Semester End sem Exam)', 'CO Direct Attainment'],
      ['', 'MST-1 (15M)', 'MST-2 (15M)', 'Assignment/Quiz (10)', '(CIE)', '', 'Total'],
      ['', '', '', '', '30% Weightage', '70% Weightage', '30%+70% for each CO']
    ];
    
    worksheet.mergeCells('B3:D3');
    headers.forEach((row, index) => {
      const rowIndex = index + 3;
      worksheet.getRow(rowIndex).values = row;
      worksheet.getRow(rowIndex).font = { bold: true };
    });
    
    // Add data
    cos.forEach((co, index) => {
      const rowIndex = index + 6;
      worksheet.getRow(rowIndex).values = [
        co,
        finalScores[co].MST1,
        finalScores[co].MST2,
        finalScores[co].Quiz,
        finalScores[co].CIE,
        finalScores[co].EndSem,
        finalScores[co].Final
      ];
    });
    
    // Style the data
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'number') {
          cell.numFmt = '0.00';
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Set header row background
    ['A3:G3', 'A4:G4', 'A5:G5'].forEach(range => {
      worksheet.getCell(range).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB4C6E7' }
      };
    });
    
    // Generate response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=CO_Attainment_${subjectCode}.xlsx`);
    
    await workbook.xlsx.write(res);
    
  } catch (error) {
    console.error('Error generating CO attainment:', error);
    res.status(500).json({ error: 'Failed to generate CO attainment sheet' });
  }
});

module.exports = router;