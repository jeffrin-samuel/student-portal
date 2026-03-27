const express = require("express");
const morgan  = require("morgan");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── View Engine Setup ────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true })); // parse HTML form POST data
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Constants ────────────────────────────────────────────────────────────────
const VALID_BRANCHES = [
  "Computer Engineering",
  "Computer Science Engineering",
  "Electronics & Computer Science",
  "Mechanical Engineering",
];

const VALID_YEARS = ["FE", "SE", "TE", "BE"];

// ─── In-Memory Database ───────────────────────────────────────────────────────
let students = [
  { id: 1, rollNo: "10455", name: "Aanya Sharma",    branch: "Computer Engineering",          year: "TE", email: "aanya.sharma@crce.edu.in",   cgpa: 9.1, phone: "9876543210" },
  { id: 2, rollNo: "10876", name: "Rohan Mehta",     branch: "Computer Science Engineering",  year: "SE", email: "rohan.mehta@crce.edu.in",    cgpa: 8.4, phone: "9876543211" },
  { id: 3, rollNo: "10855", name: "Priya Nair",      branch: "Electronics & Computer Science",year: "BE", email: "priya.nair@crce.edu.in",     cgpa: 8.9, phone: "9876543212" },
  { id: 4, rollNo: "10456", name: "Karan Patel",     branch: "Mechanical Engineering",        year: "FE", email: "karan.patel@crce.edu.in",    cgpa: 7.8, phone: "9876543213" },
  { id: 5, rollNo: "10322", name: "Sneha Kulkarni",  branch: "Computer Engineering",          year: "BE", email: "sneha.kulkarni@crce.edu.in", cgpa: 9.5, phone: "9876543214" },
];

let nextId = 6;

// ─── Helper: find student by ID ───────────────────────────────────────────────
const findStudent = (id) => students.find((s) => s.id === parseInt(id));

// ─── Helper: compute stats ────────────────────────────────────────────────────
function getStats() {
  const byYear   = { FE: 0, SE: 0, TE: 0, BE: 0 };
  const byBranch = {};
  let   totalCgpa = 0, cgpaCount = 0;

  students.forEach((s) => {
    if (byYear[s.year] !== undefined) byYear[s.year]++;
    byBranch[s.branch] = (byBranch[s.branch] || 0) + 1;
    if (s.cgpa !== null && s.cgpa !== undefined) { totalCgpa += s.cgpa; cgpaCount++; }
  });

  return {
    total:      students.length,
    averageCgpa: cgpaCount ? +(totalCgpa / cgpaCount).toFixed(2) : "—",
    byYear,
    byBranch,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /students ─────────────────────────────────────────────────────────────
// List all students (with optional search/filter/sort via query params)
app.get("/students", (req, res) => {
  let result = [...students];
  const { search, branch, year, sort } = req.query;

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q)  ||
        s.rollNo.toLowerCase().includes(q)||
        (s.email && s.email.toLowerCase().includes(q))
    );
  }
  if (branch) result = result.filter((s) => s.branch === branch);
  if (year)   result = result.filter((s) => s.year === year);

  if (sort === "name")   result.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "cgpa")   result.sort((a, b) => (b.cgpa ?? 0) - (a.cgpa ?? 0));
  if (sort === "year")   result.sort((a, b) => VALID_YEARS.indexOf(a.year) - VALID_YEARS.indexOf(b.year));
  if (sort === "rollNo") result.sort((a, b) => a.rollNo.localeCompare(b.rollNo));

  res.render("index", {
    students:  result,
    stats:     getStats(),
    branches:  VALID_BRANCHES,
    years:     VALID_YEARS,
    query:     req.query,          // pass back filters so form stays filled
    message:   req.query.message || null,
    error:     req.query.error    || null,
  });
});

// Redirect root to /students
app.get("/", (req, res) => res.redirect("/students"));

// ── GET /students/new ─────────────────────────────────────────────────────────
// Show the Add Student form
app.get("/students/new", (req, res) => {
  res.render("form", {
    title:    "Add New Student",
    action:   "/students",
    method:   "POST",
    student:  {},                  // empty — no pre-filled values
    branches: VALID_BRANCHES,
    years:    VALID_YEARS,
    error:    null,
  });
});

// ── POST /students ────────────────────────────────────────────────────────────
// Handle Add Student form submission
app.post("/students", (req, res) => {
  const { rollNo, name, branch, year, email, cgpa, phone } = req.body;

  // Server-side validation
  const errors = [];
  if (!rollNo || !rollNo.trim()) errors.push("Roll No is required");
  if (!name   || !name.trim())   errors.push("Name is required");
  if (!branch || !VALID_BRANCHES.includes(branch)) errors.push("Please select a valid branch");
  if (!year   || !VALID_YEARS.includes(year))       errors.push("Please select a valid year");
  if (email && (email.indexOf('@') < 1 || !email.slice(email.indexOf('@')+1).includes('.')))
    errors.push('Invalid email — must contain @ and a valid domain (e.g. name@domain.com)');
  if (phone && !/^\d{10}$/.test(phone.trim()))
    errors.push('Phone must be exactly 10 digits, no spaces or letters');
  if (cgpa && (isNaN(cgpa) || +cgpa < 0 || +cgpa > 10 || !/^\d+(\.\d{1,2})?$/.test(String(cgpa).trim()))) errors.push("CGPA must be between 0 and 10, with at most 2 decimal places");
  if (students.find((s) => s.rollNo.toLowerCase() === rollNo?.trim().toLowerCase()))
    errors.push(`Roll No "${rollNo}" already exists`);

  if (errors.length) {
    return res.render("form", {
      title:    "Add New Student",
      action:   "/students",
      method:   "POST",
      student:  req.body,         // re-fill form with entered values
      branches: VALID_BRANCHES,
      years:    VALID_YEARS,
      error:    errors.join(" · "),
    });
  }

  const student = {
    id:     nextId++,
    rollNo: rollNo.trim().toUpperCase(),
    name:   name.trim(),
    branch,
    year,
    email:  email?.trim() || "",
    cgpa:   cgpa ? parseFloat(cgpa) : null,
    phone:  phone?.trim() || "",
  };

  students.push(student);
  res.redirect("/students?message=Student added successfully");
});

// ── GET /students/:id ─────────────────────────────────────────────────────────
// View a single student's details
app.get("/students/:id", (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) return res.redirect("/students?error=Student not found");
  res.render("detail", { student });
});

// ── GET /students/:id/edit ────────────────────────────────────────────────────
// Show Edit Student form pre-filled with existing data
app.get("/students/:id/edit", (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) return res.redirect("/students?error=Student not found");

  res.render("form", {
    title:    "Edit Student",
    action:   `/students/${student.id}?_method=PATCH`,
    method:   "POST",             // HTML forms only support GET/POST
    student,
    branches: VALID_BRANCHES,
    years:    VALID_YEARS,
    error:    null,
  });
});

// ── POST /students/:id?_method=PATCH ─────────────────────────────────────────
// Handle Edit form submission (method override since HTML forms can't do PATCH)
app.post("/students/:id", (req, res) => {
  if (req.query._method !== "PATCH") return res.redirect("/students");

  const student = findStudent(req.params.id);
  if (!student) return res.redirect("/students?error=Student not found");

  const { rollNo, name, branch, year, email, cgpa, phone } = req.body;

  // Validation
  const errors = [];
  if (!rollNo || !rollNo.trim()) errors.push("Roll No is required");
  if (!name   || !name.trim())   errors.push("Name is required");
  if (!branch || !VALID_BRANCHES.includes(branch)) errors.push("Please select a valid branch");
  if (!year   || !VALID_YEARS.includes(year))       errors.push("Please select a valid year");
  if (email && (email.indexOf('@') < 1 || !email.slice(email.indexOf('@')+1).includes('.')))
    errors.push('Invalid email — must contain @ and a valid domain');
  if (phone && !/^\d{10}$/.test(phone.trim()))
    errors.push('Phone must be exactly 10 digits');
  if (cgpa && (isNaN(cgpa) || +cgpa < 0 || +cgpa > 10 || !/^\d+(\.\d{1,2})?$/.test(String(cgpa).trim()))) errors.push("CGPA must be between 0 and 10, with at most 2 decimal places");

  const conflict = students.find(
    (s) => s.rollNo.toLowerCase() === rollNo?.trim().toLowerCase() && s.id !== student.id
  );
  if (conflict) errors.push(`Roll No "${rollNo}" already belongs to another student`);

  if (errors.length) {
    return res.render("form", {
      title:    "Edit Student",
      action:   `/students/${student.id}?_method=PATCH`,
      method:   "POST",
      student:  { ...student, ...req.body },
      branches: VALID_BRANCHES,
      years:    VALID_YEARS,
      error:    errors.join(" · "),
    });
  }

  // Apply updates
  student.rollNo = rollNo.trim().toUpperCase();
  student.name   = name.trim();
  student.branch = branch;
  student.year   = year;
  student.email  = email?.trim() || "";
  student.cgpa   = cgpa ? parseFloat(cgpa) : null;
  student.phone  = phone?.trim() || "";

  res.redirect(`/students?message=Student updated successfully`);
});

// ── POST /students/:id?_method=DELETE ─────────────────────────────────────────
// Delete a student (method override)
app.post("/students/:id/delete", (req, res) => {
  const idx = students.findIndex((s) => s.id === parseInt(req.params.id));
  if (idx === -1) return res.redirect("/students?error=Student not found");
  students.splice(idx, 1);
  res.redirect("/students?message=Student deleted successfully");
});

// ── REST API endpoints (JSON) — bonus, for Postman / testing ─────────────────
app.get("/api/students", (req, res) => res.json({ success: true, total: students.length, data: students }));
app.get("/api/students/:id", (req, res) => {
  const s = findStudent(req.params.id);
  s ? res.json({ success: true, data: s }) : res.status(404).json({ success: false, error: "Not found" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Student Records - http://localhost:${PORT}/students\n`);
});