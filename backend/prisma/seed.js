/**
 * Seed script — populates the database with realistic demo data so you
 * can demo the app immediately (login screen, patient list, appointments,
 * bills, dashboard charts all have real-looking content out of the box).
 *
 * Run with: npm run seed
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const password = await bcrypt.hash("Password123!", 10);

  // ---------- Admin ----------
  const admin = await prisma.user.upsert({
    where: { email: "admin@hospital.com" },
    update: {},
    create: {
      name: "Aisha Khan",
      email: "admin@hospital.com",
      passwordHash: password,
      role: "ADMIN",
      phone: "+91-9000000001",
      emailVerified: true,
    },
  });

  // ---------- Receptionist ----------
  const receptionist = await prisma.user.upsert({
    where: { email: "reception@hospital.com" },
    update: {},
    create: {
      name: "Priya Sharma",
      email: "reception@hospital.com",
      passwordHash: password,
      role: "RECEPTIONIST",
      phone: "+91-9000000002",
      emailVerified: true,
    },
  });

  // ---------- Doctors ----------
  const doctorData = [
    { name: "Dr. Rohan Mehta", specialization: "Cardiology", qualification: "MD, DM Cardiology", fee: 800 },
    { name: "Dr. Sneha Iyer", specialization: "Pediatrics", qualification: "MD Pediatrics", fee: 500 },
    { name: "Dr. Arjun Verma", specialization: "Orthopedics", qualification: "MS Ortho", fee: 700 },
    { name: "Dr. Kavita Rao", specialization: "Dermatology", qualification: "MD Dermatology", fee: 600 },
  ];

  const doctors = [];
  for (let i = 0; i < doctorData.length; i++) {
    const d = doctorData[i];
    const email = `doctor${i + 1}@hospital.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: d.name,
        email,
        passwordHash: password,
        role: "DOCTOR",
        phone: `+91-90000000${10 + i}`,
        emailVerified: true,
      },
    });

    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        specialization: d.specialization,
        qualification: d.qualification,
        licenseNumber: `LIC-${1000 + i}`,
        consultationFee: d.fee,
        bio: `${d.name} is a specialist in ${d.specialization} with extensive clinical experience.`,
      },
    });

    // Mon-Fri 09:00-17:00, 30 min slots
    const existingSchedules = await prisma.doctorSchedule.count({ where: { doctorId: doctor.id } });
    if (existingSchedules === 0) {
      for (let day = 1; day <= 5; day++) {
        await prisma.doctorSchedule.create({
          data: { doctorId: doctor.id, dayOfWeek: day, startTime: "09:00", endTime: "17:00", slotMinutes: 30 },
        });
      }
    }

    doctors.push(doctor);
  }

  // ---------- Patients ----------
  const patientNames = [
    ["Ravi", "Kumar", "MALE"],
    ["Anjali", "Singh", "FEMALE"],
    ["Vikram", "Patel", "MALE"],
    ["Meera", "Nair", "FEMALE"],
    ["Suresh", "Reddy", "MALE"],
    ["Pooja", "Joshi", "FEMALE"],
  ];

  const patients = [];
  for (let i = 0; i < patientNames.length; i++) {
    const [first, last, gender] = patientNames[i];
    const existing = await prisma.patient.findFirst({ where: { firstName: first, lastName: last } });
    if (existing) {
      patients.push(existing);
      continue;
    }
    const count = await prisma.patient.count();
    const patient = await prisma.patient.create({
      data: {
        patientCode: `PAT-${String(count + 1).padStart(5, "0")}`,
        firstName: first,
        lastName: last,
        dateOfBirth: new Date(1985 + i, i % 12, (i % 28) + 1),
        gender,
        phone: `+91-90111000${i}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        address: `${100 + i} MG Road, Hyderabad`,
        bloodGroup: ["O+", "A+", "B+", "AB+", "O-", "A-"][i % 6],
        emergencyContactName: "Family Contact",
        emergencyContactPhone: `+91-90222000${i}`,
      },
    });
    patients.push(patient);
  }

  // ---------- Appointments (mix of past/completed and upcoming) ----------
  const appointments = [];
  for (let i = 0; i < 10; i++) {
    const patient = patients[i % patients.length];
    const doctor = doctors[i % doctors.length];
    const daysOffset = i - 5; // some past, some future
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    date.setHours(9 + (i % 8), i % 2 === 0 ? 0 : 30, 0, 0);

    const status = daysOffset < 0 ? "COMPLETED" : "SCHEDULED";

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        scheduledAt: date,
        durationMins: 30,
        status,
        reason: ["Routine checkup", "Follow-up", "Consultation", "Fever", "Pain"][i % 5],
        createdById: receptionist.id,
      },
    });
    appointments.push(appointment);
  }

  // ---------- Medical Records for completed appointments ----------
  for (const appt of appointments.filter((a) => a.status === "COMPLETED")) {
    await prisma.medicalRecord.create({
      data: {
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        appointmentId: appt.id,
        authorId: doctors.find((d) => d.id === appt.doctorId)?.userId || admin.id,
        diagnosis: "Mild seasonal flu",
        symptoms: "Fever, sore throat, fatigue",
        prescription: "Paracetamol 500mg twice daily for 3 days, rest and fluids",
        notes: "Patient advised to follow up if symptoms persist beyond 5 days.",
      },
    });
  }

  // ---------- Bills ----------
  for (let i = 0; i < 6; i++) {
    const patient = patients[i % patients.length];
    const doctor = doctors[i % doctors.length];
    const fee = Number(doctor.consultationFee);
    const subtotal = fee + 200; // consultation + a lab test
    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const isPaid = i % 3 !== 0;

    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(i + 1).padStart(5, "0")}`;

    await prisma.bill.create({
      data: {
        invoiceNumber,
        patientId: patient.id,
        createdById: receptionist.id,
        subtotal,
        discount: 0,
        tax,
        totalAmount: total,
        amountPaid: isPaid ? total : 0,
        paymentStatus: isPaid ? "PAID" : "UNPAID",
        paymentMethod: isPaid ? "CASH" : null,
        paidAt: isPaid ? new Date() : null,
        items: {
          create: [
            { description: "Consultation Fee", quantity: 1, unitPrice: fee, lineTotal: fee },
            { description: "Lab Test - Basic Panel", quantity: 1, unitPrice: 200, lineTotal: 200 },
          ],
        },
      },
    });
  }

  console.log("✅ Seed complete!");
  console.log("\n--- Login Credentials (all use password: Password123!) ---");
  console.log("Admin:        admin@hospital.com");
  console.log("Receptionist: reception@hospital.com");
  console.log("Doctors:      doctor1@hospital.com ... doctor4@hospital.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
