const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

// 1. Remove nodemailer require
code = code.replace(/const nodemailer = require\('nodemailer'\);\n?/, '');

// 2. Remove setupMailer and sendEmail blocks
code = code.replace(/\/\/ Nodemailer Setup[\s\S]*?async function sendEmail[\s\S]*?}\n/m, '');

// 3. Remove sendEmail from POST /api/requests
const reqRegex = /\/\/ Send Email\s*try \{\s*const \{ data: u \}[\s\S]*?\} catch\(e\) \{\}/m;
code = code.replace(reqRegex, '');

// 4. Remove sendEmail from POST /api/requests/:id/approve
const approveRegex = /try \{\s*const \{ data: u \} = await supabase\.from\('users'\)\.select\('email'\)[\s\S]*?\} catch\(e\) \{\}/m;
code = code.replace(approveRegex, '');

// 5. Remove sendEmail from Razorpay verify
// I will just find the block and remove it carefully
const verifyRegex = /\/\/ Send Email\s*const \{ data: u \} = await supabase\.from\('users'\)\.select\('email'\)[\s\S]*?\} catch\(e\) \{ console\.error\('Inventory\/Email error on payment', e\); \}/m;
code = code.replace(verifyRegex, '} catch(e) { console.error(\'Inventory error on payment\', e); }');

fs.writeFileSync('backend/server.js', code);
