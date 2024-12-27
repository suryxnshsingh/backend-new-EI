import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const getMailOptions = (email, user, resetLink) => ({
  from: '"EI_LMS" <process.env.EMAIL>',
  to: email,
  subject: 'Reset EI-LMS Password',
  text: `Hello ${user.firstName},\n\nClick the link below to reset your password:\n\n${resetLink}`,
  html: `
  <html>
    <head>
    <style>
      body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f4f9;
      color: #333;
      }
      .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }
      .header {
      text-align: center;
      padding: 10px 0;
      border-bottom: 1px solid #ddd;
      }
      .content {
      padding: 20px;
      }
      .footer {
      text-align: center;
      padding: 10px 0;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #777;
      }
      a {
      color: #007bff;
      text-decoration: none;
      }
      @media (prefers-color-scheme: dark) {
      body {
        background-color: #333;
        color: #f4f4f9;
      }
      .container {
        background-color: #444;
        color: #f4f4f9;
      }
      .header, .footer {
        border-color: #555;
      }
      }
      @media (max-width: 600px) {
      .container {
        padding: 10px;
      }
      .content {
        padding: 10px;
      }
      }
    </style>
    </head>
    <body>
    <div class="container">
      <div class="header">
      <h1>Reset Your Password</h1>
      </div>
      <div class="content">
      <p>Hello ${user.firstName},</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      </div>
      <div class="footer">
      <p>&copy; ${new Date().getFullYear()} EI_LMS. All rights reserved.</p>
      </div>
    </div>
    </body>
  </html>
  `
});

export { transporter, getMailOptions };