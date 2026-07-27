import mongoose from 'mongoose';

const institutionQualityAuditSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionMaster',
      required: true,
      index: true,
    },
    hygieneScore: { type: Number, min: 0, max: 100, default: 85 },
    sanitationGrade: { type: String, enum: ['A+', 'A', 'B', 'C'], default: 'A+' },
    fireSafetyValid: { type: Boolean, default: true },
    fireNocExpiry: { type: Date },
    foodSafetyLicenseNo: { type: String, default: '' },
    inspectorName: { type: String, default: 'District Audit Committee' },
    auditDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['passed', 'conditional', 'failed'], default: 'passed' },
  },
  { timestamps: true }
);

export default mongoose.model('InstitutionQualityAudit', institutionQualityAuditSchema);
