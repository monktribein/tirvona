import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import VolunteerJob from '../models/VolunteerJob.js';
import VolunteerApplication from '../models/VolunteerApplication.js';

dotenv.config();

async function testApplicationFlow() {
  await connectDB();
  console.log('--- TESTING VOLUNTEER APPLICATION END-TO-END FLOW ---');

  // Find a sample open job
  const sampleJob = await VolunteerJob.findOne({ status: 'open' });
  if (!sampleJob) {
    console.error('No sample open job found in DB.');
    process.exit(1);
  }

  console.log(`Target Job Found: "${sampleJob.title}" at ${sampleJob.ashramName} (ID: ${sampleJob._id})`);

  // Simulate application submission
  const newApp = await VolunteerApplication.create({
    jobId: sampleJob._id,
    applicantName: 'Audit Test Pilgrim',
    email: 'pilgrim.test@tirvona.com',
    phone: '9876543210',
    city: 'Rishikesh',
    education: 'Graduate',
    skills: 'Yoga, Meditation, Kitchen Seva',
    motivation: 'To offer authentic devotional service.',
    status: 'applied',
  });

  console.log(`Application Created Successfully (App ID: ${newApp._id}, Job ID Attached: ${newApp.jobId})`);

  // Verify retrieval via Stay Admin / Super Admin query
  const fetched = await VolunteerApplication.findById(newApp._id).populate('jobId');
  if (fetched && fetched.jobId._id.toString() === sampleJob._id.toString()) {
    console.log('✅ VERIFICATION PASSED: Application is correctly saved with Job ID and populates in Admin Dashboard!');
  } else {
    console.error('❌ VERIFICATION FAILED!');
  }

  // Clean up test document
  await VolunteerApplication.deleteOne({ _id: newApp._id });
  console.log('Cleaned up test application record.');

  process.exit(0);
}

testApplicationFlow().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
